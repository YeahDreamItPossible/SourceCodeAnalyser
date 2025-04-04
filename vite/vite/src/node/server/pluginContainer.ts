import fs from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { parseAst as rollupParseAst } from "rollup/parseAst";
import type {
  AsyncPluginHooks,
  CustomPluginOptions,
  EmittedFile,
  FunctionPluginHooks,
  InputOptions,
  LoadResult,
  MinimalPluginContext,
  ModuleInfo,
  ModuleOptions,
  NormalizedInputOptions,
  OutputOptions,
  ParallelPluginHooks,
  PartialNull,
  PartialResolvedId,
  ResolvedId,
  RollupError,
  RollupLog,
  PluginContext as RollupPluginContext,
  TransformPluginContext as RollupTransformPluginContext,
  SourceDescription,
  SourceMap,
  TransformResult,
} from "rollup";
import type { RawSourceMap } from "@ampproject/remapping";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import MagicString from "magic-string";
import type { FSWatcher } from "dep-types/chokidar";
import colors from "picocolors";
import type { Plugin } from "../plugin";
import {
  combineSourcemaps,
  createDebugger,
  ensureWatchedFile,
  generateCodeFrame,
  isExternalUrl,
  isObject,
  normalizePath,
  numberToPos,
  prettifyUrl,
  rollupVersion,
  timeFrom,
} from "../utils";
import { FS_PREFIX } from "../constants";
import { createPluginHookUtils, getHookHandler } from "../plugins";
import { cleanUrl, unwrapId } from "../../shared/utils";
import type { PluginHookUtils } from "../config";
import type { Environment } from "../environment";
import type { DevEnvironment } from "./environment";
import { buildErrorMessage } from "./middlewares/error";
import type {
  EnvironmentModuleGraph,
  EnvironmentModuleNode,
} from "./moduleGraph";

const noop = () => {};

// same default value of "moduleInfo.meta" as in Rollup
const EMPTY_OBJECT = Object.freeze({});

const debugSourcemapCombineFilter =
  process.env.DEBUG_VITE_SOURCEMAP_COMBINE_FILTER;
const debugSourcemapCombine = createDebugger("vite:sourcemap-combine", {
  onlyWhenFocused: true,
});
const debugResolve = createDebugger("vite:resolve");
const debugPluginResolve = createDebugger("vite:plugin-resolve", {
  onlyWhenFocused: "vite:plugin",
});
const debugPluginTransform = createDebugger("vite:plugin-transform", {
  onlyWhenFocused: "vite:plugin",
});

export const ERR_CLOSED_SERVER = "ERR_CLOSED_SERVER";

export function throwClosedServerError(): never {
  const err: any = new Error(
    "The server is being restarted or closed. Request is outdated"
  );
  err.code = ERR_CLOSED_SERVER;
  // This error will be caught by the transform middleware that will
  // send a 504 status code request timeout
  throw err;
}

export interface PluginContainerOptions {
  cwd?: string;
  output?: OutputOptions;
  modules?: Map<string, { info: ModuleInfo }>;
  writeFile?: (name: string, source: string | Uint8Array) => void;
}

// 创建 环境插件容器
export async function createEnvironmentPluginContainer(
  environment: Environment,
  plugins: Plugin[],
  watcher?: FSWatcher
): Promise<EnvironmentPluginContainer> {
  const container = new EnvironmentPluginContainer(
    environment,
    plugins,
    watcher
  );
  await container.resolveRollupOptions();
  return container;
}

// 环境插件容器
// 作用:
// 调用 特定钩子队列
class EnvironmentPluginContainer {
  private _pluginContextMap = new Map<Plugin, PluginContext>();
  private _resolvedRollupOptions?: InputOptions;
  private _processesing = new Set<Promise<any>>();
  private _seenResolves: Record<string, true | undefined> = {};

  // _addedFiles from the `load()` hook gets saved here so it can be reused in the `transform()` hook
  private _moduleNodeToLoadAddedImports = new WeakMap<
    EnvironmentModuleNode,
    Set<string> | null
  >();

  getSortedPluginHooks: PluginHookUtils["getSortedPluginHooks"];
  getSortedPlugins: PluginHookUtils["getSortedPlugins"];

  moduleGraph: EnvironmentModuleGraph | undefined;
  watchFiles = new Set<string>();
  minimalContext: MinimalPluginContext;

  private _started = false;
  private _buildStartPromise: Promise<void> | undefined;
  private _closed = false;

  constructor(
    public environment: Environment,
    public plugins: Plugin[],
    public watcher?: FSWatcher
  ) {
    this.minimalContext = {
      meta: {
        rollupVersion,
        watchMode: true,
      },
      debug: noop,
      info: noop,
      warn: noop,
      // @ts-expect-error noop
      error: noop,
      environment,
    };
    const utils = createPluginHookUtils(plugins);
    this.getSortedPlugins = utils.getSortedPlugins;
    this.getSortedPluginHooks = utils.getSortedPluginHooks;
    this.moduleGraph =
      environment.mode === "dev" ? environment.moduleGraph : undefined;
  }

  private _updateModuleLoadAddedImports(
    id: string,
    addedImports: Set<string> | null
  ): void {
    const module = this.moduleGraph?.getModuleById(id);
    if (module) {
      this._moduleNodeToLoadAddedImports.set(module, addedImports);
    }
  }

  private _getAddedImports(id: string): Set<string> | null {
    const module = this.moduleGraph?.getModuleById(id);
    return module
      ? this._moduleNodeToLoadAddedImports.get(module) || null
      : null;
  }

  // 返回 模块信息
  getModuleInfo(id: string): ModuleInfo | null {
    const module = this.moduleGraph?.getModuleById(id);
    if (!module) {
      return null;
    }
    if (!module.info) {
      module.info = new Proxy(
        { id, meta: module.meta || EMPTY_OBJECT } as ModuleInfo,
        // throw when an unsupported ModuleInfo property is accessed,
        // so that incompatible plugins fail in a non-cryptic way.
        {
          get(info: any, key: string) {
            if (key in info) {
              return info[key];
            }
            // Don't throw an error when returning from an async function
            if (key === "then") {
              return undefined;
            }
            throw Error(
              `[vite] The "${key}" property of ModuleInfo is not supported.`
            );
          },
        }
      );
    }
    return module.info ?? null;
  }

  // 追踪 钩子 promise，以便在关闭服务器时等待所有钩子完成
  private handleHookPromise<T>(maybePromise: undefined | T | Promise<T>) {
    if (!(maybePromise as any)?.then) {
      return maybePromise;
    }
    const promise = maybePromise as Promise<T>;
    this._processesing.add(promise);
    return promise.finally(() => this._processesing.delete(promise));
  }

  get options(): InputOptions {
    return this._resolvedRollupOptions!;
  }

  // 返回经过 rollup 插件加工后的 rollup选项
  async resolveRollupOptions(): Promise<InputOptions> {
    if (!this._resolvedRollupOptions) {
      let options = this.environment.config.build.rollupOptions;
      // 依次运行插件的 hooks.options 队列 并绑定处理后的选项
      for (const optionsHook of this.getSortedPluginHooks("options")) {
        if (this._closed) {
          throwClosedServerError();
        }
        options =
          (await this.handleHookPromise(
            optionsHook.call(this.minimalContext, options)
          )) || options;
      }
      this._resolvedRollupOptions = options;
    }
    return this._resolvedRollupOptions;
  }

  // 返回 插件 对应的 插件上下文
  private _getPluginContext(plugin: Plugin) {
    if (!this._pluginContextMap.has(plugin)) {
      this._pluginContextMap.set(plugin, new PluginContext(plugin, this));
    }
    return this._pluginContextMap.get(plugin)!;
  }

  // 并行 执行所有的特定钩子队列
  private async hookParallel<H extends AsyncPluginHooks & ParallelPluginHooks>(
    hookName: H,
    context: (plugin: Plugin) => ThisType<FunctionPluginHooks[H]>,
    args: (plugin: Plugin) => Parameters<FunctionPluginHooks[H]>,
    condition?: (plugin: Plugin) => boolean
  ): Promise<void> {
    const parallelPromises: Promise<unknown>[] = [];
    for (const plugin of this.getSortedPlugins(hookName)) {
      // Don't throw here if closed, so buildEnd and closeBundle hooks can finish running
      const hook = plugin[hookName];
      if (!hook) continue;
      if (condition && !condition(plugin)) continue;

      const handler: Function = getHookHandler(hook);
      if ((hook as { sequential?: boolean }).sequential) {
        await Promise.all(parallelPromises);
        parallelPromises.length = 0;
        await handler.apply(context(plugin), args(plugin));
      } else {
        parallelPromises.push(handler.apply(context(plugin), args(plugin)));
      }
    }
    await Promise.all(parallelPromises);
  }

  // 开始构建
  async buildStart(_options?: InputOptions): Promise<void> {
    if (this._started) {
      if (this._buildStartPromise) {
        await this._buildStartPromise;
      }
      return;
    }
    this._started = true;
    this._buildStartPromise = this.handleHookPromise(
      this.hookParallel(
        "buildStart",
        (plugin) => this._getPluginContext(plugin),
        () => [this.options as NormalizedInputOptions],
        (plugin) =>
          this.environment.name === "client" ||
          plugin.perEnvironmentStartEndDuringDev === true
      )
    ) as Promise<void>;
    await this._buildStartPromise;
    this._buildStartPromise = undefined;
  }

  // 解析资源路径
  async resolveId(
    rawId: string,
    importer: string | undefined = join(
      this.environment.config.root,
      "index.html"
    ),
    options?: {
      attributes?: Record<string, string>;
      custom?: CustomPluginOptions;
      skip?: Set<Plugin>;
      /**
       * @internal
       */
      scan?: boolean;
      isEntry?: boolean;
    }
  ): Promise<PartialResolvedId | null> {
    if (!this._started) {
      this.buildStart();
      await this._buildStartPromise;
    }
    const skip = options?.skip;
    const scan = !!options?.scan;
    const ssr = this.environment.config.consumer === "server";
    const ctx = new ResolveIdContext(this, skip, scan);

    const resolveStart = debugResolve ? performance.now() : 0;
    let id: string | null = null;
    const partial: Partial<PartialResolvedId> = {};
    for (const plugin of this.getSortedPlugins("resolveId")) {
      if (this._closed && this.environment.config.dev.recoverable)
        throwClosedServerError();
      if (!plugin.resolveId) continue;
      if (skip?.has(plugin)) continue;

      ctx._plugin = plugin;

      const pluginResolveStart = debugPluginResolve ? performance.now() : 0;
      const handler = getHookHandler(plugin.resolveId);
      const result = await this.handleHookPromise(
        handler.call(ctx as any, rawId, importer, {
          attributes: options?.attributes ?? {},
          custom: options?.custom,
          isEntry: !!options?.isEntry,
          ssr,
          scan,
        })
      );
      if (!result) continue;

      if (typeof result === "string") {
        id = result;
      } else {
        id = result.id;
        Object.assign(partial, result);
      }

      debugPluginResolve?.(
        timeFrom(pluginResolveStart),
        plugin.name,
        prettifyUrl(id, this.environment.config.root)
      );

      // 当某个 resolveId 有返回值时 则会中断当前任务队列
      // resolveId() is hookFirst - first non-null result is returned.
      break;
    }

    if (debugResolve && rawId !== id && !rawId.startsWith(FS_PREFIX)) {
      const key = rawId + id;
      // avoid spamming
      if (!this._seenResolves[key]) {
        this._seenResolves[key] = true;
        debugResolve(
          `${timeFrom(resolveStart)} ${colors.cyan(rawId)} -> ${colors.dim(id)}`
        );
      }
    }

    if (id) {
      partial.id = isExternalUrl(id) ? id : normalizePath(id);
      return partial as PartialResolvedId;
    } else {
      return null;
    }
  }

  // 加载资源
  async load(id: string): Promise<LoadResult | null> {
    const ssr = this.environment.config.consumer === "server";
    const options = { ssr };
    const ctx = new LoadPluginContext(this);
    for (const plugin of this.getSortedPlugins("load")) {
      if (this._closed && this.environment.config.dev.recoverable)
        throwClosedServerError();
      if (!plugin.load) continue;
      ctx._plugin = plugin;
      const handler = getHookHandler(plugin.load);
      const result = await this.handleHookPromise(
        handler.call(ctx as any, id, options)
      );
      if (result != null) {
        if (isObject(result)) {
          ctx._updateModuleInfo(id, result);
        }
        this._updateModuleLoadAddedImports(id, ctx._addedImports);
        return result;
      }
    }
    this._updateModuleLoadAddedImports(id, ctx._addedImports);
    return null;
  }

  // 转换资源
  async transform(
    code: string,
    id: string,
    options?: {
      inMap?: SourceDescription["map"];
    }
  ): Promise<{ code: string; map: SourceMap | { mappings: "" } | null }> {
    const ssr = this.environment.config.consumer === "server";
    const optionsWithSSR = options ? { ...options, ssr } : { ssr };
    const inMap = options?.inMap;

    const ctx = new TransformPluginContext(this, id, code, inMap as SourceMap);
    ctx._addedImports = this._getAddedImports(id);

    for (const plugin of this.getSortedPlugins("transform")) {
      if (this._closed && this.environment.config.dev.recoverable)
        throwClosedServerError();
      if (!plugin.transform) continue;

      ctx._updateActiveInfo(plugin, id, code);
      const start = debugPluginTransform ? performance.now() : 0;
      let result: TransformResult | string | undefined;
      const handler = getHookHandler(plugin.transform);
      try {
        result = await this.handleHookPromise(
          handler.call(ctx as any, code, id, optionsWithSSR)
        );
      } catch (e) {
        ctx.error(e);
      }
      if (!result) continue;
      debugPluginTransform?.(
        timeFrom(start),
        plugin.name,
        prettifyUrl(id, this.environment.config.root)
      );
      if (isObject(result)) {
        if (result.code !== undefined) {
          code = result.code;
          if (result.map) {
            if (debugSourcemapCombine) {
              // @ts-expect-error inject plugin name for debug purpose
              result.map.name = plugin.name;
            }
            ctx.sourcemapChain.push(result.map);
          }
        }
        ctx._updateModuleInfo(id, result);
      } else {
        code = result;
      }
    }
    return {
      code,
      map: ctx._getCombinedSourcemap(),
    };
  }

  async watchChange(
    id: string,
    change: { event: "create" | "update" | "delete" }
  ): Promise<void> {
    await this.hookParallel(
      "watchChange",
      (plugin) => this._getPluginContext(plugin),
      () => [id, change]
    );
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await Promise.allSettled(Array.from(this._processesing));
    await this.hookParallel(
      "buildEnd",
      (plugin) => this._getPluginContext(plugin),
      () => [],
      (plugin) =>
        this.environment.name === "client" ||
        plugin.perEnvironmentStartEndDuringDev !== true
    );
    await this.hookParallel(
      "closeBundle",
      (plugin) => this._getPluginContext(plugin),
      () => []
    );
  }
}

// 插件上下文
class PluginContext implements Omit<RollupPluginContext, "cache"> {
  ssr = false;
  _scan = false;
  _activeId: string | null = null;
  _activeCode: string | null = null;
  _resolveSkips?: Set<Plugin>;
  meta: RollupPluginContext["meta"];
  environment: Environment;

  constructor(
    public _plugin: Plugin,
    public _container: EnvironmentPluginContainer
  ) {
    this.environment = this._container.environment;
    this.meta = this._container.minimalContext.meta;
  }

  parse(code: string, opts: any) {
    return rollupParseAst(code, opts);
  }

  async resolve(
    id: string,
    importer?: string,
    options?: {
      attributes?: Record<string, string>;
      custom?: CustomPluginOptions;
      isEntry?: boolean;
      skipSelf?: boolean;
    }
  ) {
    let skip: Set<Plugin> | undefined;
    if (options?.skipSelf !== false && this._plugin) {
      skip = new Set(this._resolveSkips);
      skip.add(this._plugin);
    }
    let out = await this._container.resolveId(id, importer, {
      attributes: options?.attributes,
      custom: options?.custom,
      isEntry: !!options?.isEntry,
      skip,
      scan: this._scan,
    });
    if (typeof out === "string") out = { id: out };
    return out as ResolvedId | null;
  }

  async load(
    options: {
      id: string;
      resolveDependencies?: boolean;
    } & Partial<PartialNull<ModuleOptions>>
  ): Promise<ModuleInfo> {
    // We may not have added this to our module graph yet, so ensure it exists
    await this._container.moduleGraph?.ensureEntryFromUrl(unwrapId(options.id));
    // Not all options passed to this function make sense in the context of loading individual files,
    // but we can at least update the module info properties we support
    this._updateModuleInfo(options.id, options);

    const loadResult = await this._container.load(options.id);
    const code = typeof loadResult === "object" ? loadResult?.code : loadResult;
    if (code != null) {
      await this._container.transform(code, options.id);
    }

    const moduleInfo = this.getModuleInfo(options.id);
    // This shouldn't happen due to calling ensureEntryFromUrl, but 1) our types can't ensure that
    // and 2) moduleGraph may not have been provided (though in the situations where that happens,
    // we should never have plugins calling this.load)
    if (!moduleInfo) throw Error(`Failed to load module with id ${options.id}`);
    return moduleInfo;
  }

  getModuleInfo(id: string): ModuleInfo | null {
    return this._container.getModuleInfo(id);
  }

  _updateModuleInfo(id: string, { meta }: { meta?: object | null }) {
    if (meta) {
      const moduleInfo = this.getModuleInfo(id);
      if (moduleInfo) {
        moduleInfo.meta = { ...moduleInfo.meta, ...meta };
      }
    }
  }

  getModuleIds(): IterableIterator<string> {
    return this._container.moduleGraph
      ? this._container.moduleGraph.idToModuleMap.keys()
      : Array.prototype[Symbol.iterator]();
  }

  addWatchFile(id: string): void {
    this._container.watchFiles.add(id);
    if (this._container.watcher)
      ensureWatchedFile(
        this._container.watcher,
        id,
        this.environment.config.root
      );
  }

  getWatchFiles(): string[] {
    return [...this._container.watchFiles];
  }

  emitFile(_assetOrFile: EmittedFile): string {
    this._warnIncompatibleMethod(`emitFile`);
    return "";
  }

  setAssetSource(): void {
    this._warnIncompatibleMethod(`setAssetSource`);
  }

  getFileName(): string {
    this._warnIncompatibleMethod(`getFileName`);
    return "";
  }

  warn(
    e: string | RollupLog | (() => string | RollupLog),
    position?: number | { column: number; line: number }
  ): void {
    const err = this._formatError(typeof e === "function" ? e() : e, position);
    const msg = buildErrorMessage(
      err,
      [colors.yellow(`warning: ${err.message}`)],
      false
    );
    this.environment.logger.warn(msg, {
      clear: true,
      timestamp: true,
    });
  }

  error(
    e: string | RollupError,
    position?: number | { column: number; line: number }
  ): never {
    // error thrown here is caught by the transform middleware and passed on
    // the the error middleware.
    throw this._formatError(e, position);
  }

  debug = noop;
  info = noop;

  private _formatError(
    e: string | RollupError,
    position: number | { column: number; line: number } | undefined
  ): RollupError {
    const err = (typeof e === "string" ? new Error(e) : e) as RollupError;
    if (err.pluginCode) {
      return err; // The plugin likely called `this.error`
    }
    if (this._plugin) err.plugin = this._plugin.name;
    if (this._activeId && !err.id) err.id = this._activeId;
    if (this._activeCode) {
      err.pluginCode = this._activeCode;

      // some rollup plugins, e.g. json, sets err.position instead of err.pos
      const pos = position ?? err.pos ?? (err as any).position;

      if (pos != null) {
        let errLocation;
        try {
          errLocation = numberToPos(this._activeCode, pos);
        } catch (err2) {
          this.environment.logger.error(
            colors.red(
              `Error in error handler:\n${err2.stack || err2.message}\n`
            ),
            // print extra newline to separate the two errors
            { error: err2 }
          );
          throw err;
        }
        err.loc = err.loc || {
          file: err.id,
          ...errLocation,
        };
        err.frame = err.frame || generateCodeFrame(this._activeCode, pos);
      } else if (err.loc) {
        // css preprocessors may report errors in an included file
        if (!err.frame) {
          let code = this._activeCode;
          if (err.loc.file) {
            err.id = normalizePath(err.loc.file);
            try {
              code = fs.readFileSync(err.loc.file, "utf-8");
            } catch {}
          }
          err.frame = generateCodeFrame(code, err.loc);
        }
      } else if ((err as any).line && (err as any).column) {
        err.loc = {
          file: err.id,
          line: (err as any).line,
          column: (err as any).column,
        };
        err.frame = err.frame || generateCodeFrame(this._activeCode, err.loc);
      }

      // TODO: move it to overrides
      if (
        this instanceof TransformPluginContext &&
        typeof err.loc?.line === "number" &&
        typeof err.loc?.column === "number"
      ) {
        const rawSourceMap = this._getCombinedSourcemap();
        if (rawSourceMap && "version" in rawSourceMap) {
          const traced = new TraceMap(rawSourceMap as any);
          const { source, line, column } = originalPositionFor(traced, {
            line: Number(err.loc.line),
            column: Number(err.loc.column),
          });
          if (source && line != null && column != null) {
            err.loc = { file: source, line, column };
          }
        }
      }
    } else if (err.loc) {
      if (!err.frame) {
        let code = err.pluginCode;
        if (err.loc.file) {
          err.id = normalizePath(err.loc.file);
          if (!code) {
            try {
              code = fs.readFileSync(err.loc.file, "utf-8");
            } catch {}
          }
        }
        if (code) {
          err.frame = generateCodeFrame(`${code}`, err.loc);
        }
      }
    }

    if (
      typeof err.loc?.column !== "number" &&
      typeof err.loc?.line !== "number" &&
      !err.loc?.file
    ) {
      delete err.loc;
    }

    return err;
  }

  _warnIncompatibleMethod(method: string): void {
    this.environment.logger.warn(
      colors.cyan(`[plugin:${this._plugin.name}] `) +
        colors.yellow(
          `context method ${colors.bold(
            `${method}()`
          )} is not supported in serve mode. This plugin is likely not vite-compatible.`
        )
    );
  }
}

// 解析ID钩子上下文
class ResolveIdContext extends PluginContext {
  constructor(
    container: EnvironmentPluginContainer,
    skip: Set<Plugin> | undefined,
    scan: boolean
  ) {
    super(null!, container);
    this._resolveSkips = skip;
    this._scan = scan;
  }
}

// 加载钩子上下文
class LoadPluginContext extends PluginContext {
  _addedImports: Set<string> | null = null;

  constructor(container: EnvironmentPluginContainer) {
    super(null!, container);
  }

  override addWatchFile(id: string): void {
    if (!this._addedImports) {
      this._addedImports = new Set();
    }
    this._addedImports.add(id);
    super.addWatchFile(id);
  }
}

class TransformPluginContext
  extends LoadPluginContext
  implements Omit<RollupTransformPluginContext, "cache">
{
  filename: string;
  originalCode: string;
  originalSourcemap: SourceMap | null = null;
  sourcemapChain: NonNullable<SourceDescription["map"]>[] = [];
  combinedMap: SourceMap | { mappings: "" } | null = null;

  constructor(
    container: EnvironmentPluginContainer,
    id: string,
    code: string,
    inMap?: SourceMap | string
  ) {
    super(container);

    this.filename = id;
    this.originalCode = code;
    if (inMap) {
      if (debugSourcemapCombine) {
        // @ts-expect-error inject name for debug purpose
        inMap.name = "$inMap";
      }
      this.sourcemapChain.push(inMap);
    }
  }

  _getCombinedSourcemap(): SourceMap {
    if (
      debugSourcemapCombine &&
      debugSourcemapCombineFilter &&
      this.filename.includes(debugSourcemapCombineFilter)
    ) {
      debugSourcemapCombine("----------", this.filename);
      debugSourcemapCombine(this.combinedMap);
      debugSourcemapCombine(this.sourcemapChain);
      debugSourcemapCombine("----------");
    }

    let combinedMap = this.combinedMap;
    // { mappings: '' }
    if (
      combinedMap &&
      !("version" in combinedMap) &&
      combinedMap.mappings === ""
    ) {
      this.sourcemapChain.length = 0;
      return combinedMap as SourceMap;
    }

    for (let m of this.sourcemapChain) {
      if (typeof m === "string") m = JSON.parse(m);
      if (!("version" in (m as SourceMap))) {
        // { mappings: '' }
        if ((m as SourceMap).mappings === "") {
          combinedMap = { mappings: "" };
          break;
        }
        // empty, nullified source map
        combinedMap = null;
        break;
      }
      if (!combinedMap) {
        const sm = m as SourceMap;
        // sourcemap should not include `sources: [null]` (because `sources` should be string) nor
        // `sources: ['']` (because `''` means the path of sourcemap)
        // but MagicString generates this when `filename` option is not set.
        // Rollup supports these and therefore we support this as well
        if (sm.sources.length === 1 && !sm.sources[0]) {
          combinedMap = {
            ...sm,
            sources: [this.filename],
            sourcesContent: [this.originalCode],
          };
        } else {
          combinedMap = sm;
        }
      } else {
        combinedMap = combineSourcemaps(cleanUrl(this.filename), [
          m as RawSourceMap,
          combinedMap as RawSourceMap,
        ]) as SourceMap;
      }
    }
    if (combinedMap !== this.combinedMap) {
      this.combinedMap = combinedMap;
      this.sourcemapChain.length = 0;
    }
    return this.combinedMap as SourceMap;
  }

  getCombinedSourcemap(): SourceMap {
    const map = this._getCombinedSourcemap() as SourceMap | { mappings: "" };
    if (!map || (!("version" in map) && map.mappings === "")) {
      return new MagicString(this.originalCode).generateMap({
        includeContent: true,
        hires: "boundary",
        source: cleanUrl(this.filename),
      });
    }
    return map;
  }

  _updateActiveInfo(plugin: Plugin, id: string, code: string): void {
    this._plugin = plugin;
    this._activeId = id;
    this._activeCode = code;
  }
}

export type {
  EnvironmentPluginContainer,
  TransformPluginContext,
  TransformResult,
};

// 插件容器
// 作用:
// 调用 特定环境插件容器(EnvironmentPluginContainer) 的 特定钩子
class PluginContainer {
  constructor(private environments: Record<string, Environment>) {}

  // 返回 特定环境
  private _getEnvironment(options?: {
    ssr?: boolean;
    environment?: Environment;
  }) {
    return options?.environment
      ? options.environment
      : this.environments?.[options?.ssr ? "ssr" : "client"];
  }

  // 返回 特定环境 的 插件容器
  private _getPluginContainer(options?: {
    ssr?: boolean;
    environment?: Environment;
  }) {
    return (this._getEnvironment(options) as DevEnvironment).pluginContainer;
  }

  getModuleInfo(id: string): ModuleInfo | null {
    return (
      (
        this.environments.client as DevEnvironment
      ).pluginContainer.getModuleInfo(id) ||
      (this.environments.ssr as DevEnvironment).pluginContainer.getModuleInfo(
        id
      )
    );
  }

  // 返回 特定环境 的 插件容器 的 选项
  get options(): InputOptions {
    return (this.environments.client as DevEnvironment).pluginContainer.options;
  }

  // buildStart 钩子
  async buildStart(_options?: InputOptions): Promise<void> {
    (this.environments.client as DevEnvironment).pluginContainer.buildStart(
      _options
    );
  }

  async watchChange(
    id: string,
    change: { event: "create" | "update" | "delete" }
  ): Promise<void> {
    (this.environments.client as DevEnvironment).pluginContainer.watchChange(
      id,
      change
    );
  }

  async resolveId(
    rawId: string,
    importer?: string,
    options?: {
      attributes?: Record<string, string>;
      custom?: CustomPluginOptions;
      skip?: Set<Plugin>;
      ssr?: boolean;
      /**
       * @internal
       */
      scan?: boolean;
      isEntry?: boolean;
    }
  ): Promise<PartialResolvedId | null> {
    return this._getPluginContainer(options).resolveId(
      rawId,
      importer,
      options
    );
  }

  async load(
    id: string,
    options?: {
      ssr?: boolean;
    }
  ): Promise<LoadResult | null> {
    return this._getPluginContainer(options).load(id);
  }

  async transform(
    code: string,
    id: string,
    options?: {
      ssr?: boolean;
      environment?: Environment;
      inMap?: SourceDescription["map"];
    }
  ): Promise<{ code: string; map: SourceMap | { mappings: "" } | null }> {
    return this._getPluginContainer(options).transform(code, id, options);
  }

  async close(): Promise<void> {
    // noop, close will be called for each environment
  }
}

// 创建 插件容器 的实例
export function createPluginContainer(
  environments: Record<string, Environment>
): PluginContainer {
  return new PluginContainer(environments);
}

export type { PluginContainer };
