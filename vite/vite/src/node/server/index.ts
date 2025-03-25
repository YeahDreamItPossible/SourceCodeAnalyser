import path from "node:path";
import { execSync } from "node:child_process";
import type * as net from "node:net";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import type * as http from "node:http";
import { performance } from "node:perf_hooks";
import type { Http2SecureServer } from "node:http2";
import connect from "connect";
import corsMiddleware from "cors";
import colors from "picocolors";
import chokidar from "chokidar";
import type { FSWatcher, WatchOptions } from "dep-types/chokidar";
import type { Connect } from "dep-types/connect";
import launchEditorMiddleware from "launch-editor-middleware";
import type { SourceMap } from "rollup";
import type { ModuleRunner } from "vite/module-runner";
import type { CommonServerOptions } from "../http";
import {
  httpServerStart,
  resolveHttpServer,
  resolveHttpsConfig,
  setClientErrorHandler,
} from "../http";
import type { InlineConfig, ResolvedConfig } from "../config";
import { resolveConfig } from "../config";
import {
  diffDnsOrderChange,
  isInNodeModules,
  isObject,
  isParentDirectory,
  mergeConfig,
  normalizePath,
  resolveHostname,
  resolveServerUrls,
  setupSIGTERMListener,
  teardownSIGTERMListener,
} from "../utils";
import { getFsUtils } from "../fsUtils";
import { ssrLoadModule } from "../ssr/ssrModuleLoader";
import { ssrFixStacktrace, ssrRewriteStacktrace } from "../ssr/ssrStacktrace";
import { ssrTransform } from "../ssr/ssrTransform";
import { bindCLIShortcuts } from "../shortcuts";
import type { BindCLIShortcutsOptions } from "../shortcuts";
import {
  CLIENT_DIR,
  DEFAULT_DEV_PORT,
  ERR_OUTDATED_OPTIMIZED_DEP,
} from "../constants";
import type { Logger } from "../logger";
import { printServerUrls } from "../logger";
import { warnFutureDeprecation } from "../deprecations";
import {
  createNoopWatcher,
  getResolvedOutDirs,
  resolveChokidarOptions,
  resolveEmptyOutDir,
} from "../watch";
import { initPublicFiles } from "../publicDir";
import { getEnvFilesForMode } from "../env";
import type { PluginContainer } from "./pluginContainer";
import { ERR_CLOSED_SERVER, createPluginContainer } from "./pluginContainer";
import type { WebSocketServer } from "./ws";
import { createWebSocketServer } from "./ws";
import { baseMiddleware } from "./middlewares/base";
import { proxyMiddleware } from "./middlewares/proxy";
import { htmlFallbackMiddleware } from "./middlewares/htmlFallback";
import {
  cachedTransformMiddleware,
  transformMiddleware,
} from "./middlewares/transform";
import {
  createDevHtmlTransformFn,
  indexHtmlMiddleware,
} from "./middlewares/indexHtml";
import {
  servePublicMiddleware,
  serveRawFsMiddleware,
  serveStaticMiddleware,
} from "./middlewares/static";
import { timeMiddleware } from "./middlewares/time";
import { ModuleGraph } from "./mixedModuleGraph";
import type { ModuleNode } from "./mixedModuleGraph";
import { notFoundMiddleware } from "./middlewares/notFound";
import { errorMiddleware } from "./middlewares/error";
import type { HmrOptions, HotBroadcaster } from "./hmr";
import {
  createDeprecatedHotBroadcaster,
  handleHMRUpdate,
  updateModules,
} from "./hmr";
import { openBrowser as _openBrowser } from "./openBrowser";
import type { TransformOptions, TransformResult } from "./transformRequest";
import { transformRequest } from "./transformRequest";
import { searchForPackageRoot, searchForWorkspaceRoot } from "./searchRoot";
import { warmupFiles } from "./warmup";
import type { DevEnvironment } from "./environment";

export interface ServerOptions extends CommonServerOptions {
  /**
   * Configure HMR-specific options (port, host, path & protocol)
   */
  hmr?: HmrOptions | boolean;
  /**
   * Do not start the websocket connection.
   * @experimental
   */
  ws?: false;
  /**
   * Warm-up files to transform and cache the results in advance. This improves the
   * initial page load during server starts and prevents transform waterfalls.
   */
  warmup?: {
    /**
     * The files to be transformed and used on the client-side. Supports glob patterns.
     */
    clientFiles?: string[];
    /**
     * The files to be transformed and used in SSR. Supports glob patterns.
     */
    ssrFiles?: string[];
  };
  /**
   * chokidar watch options or null to disable FS watching
   * https://github.com/paulmillr/chokidar#api
   */
  watch?: WatchOptions | null;
  /**
   * Create Vite dev server to be used as a middleware in an existing server
   * @default false
   */
  middlewareMode?:
    | boolean
    | {
        /**
         * Parent server instance to attach to
         *
         * This is needed to proxy WebSocket connections to the parent server.
         */
        server: HttpServer;
      };
  /**
   * Options for files served via '/\@fs/'.
   */
  fs?: FileSystemServeOptions;
  /**
   * Origin for the generated asset URLs.
   *
   * @example `http://127.0.0.1:8080`
   */
  origin?: string;
  /**
   * Pre-transform known direct imports
   * @default true
   */
  preTransformRequests?: boolean;
  /**
   * Whether or not to ignore-list source files in the dev server sourcemap, used to populate
   * the [`x_google_ignoreList` source map extension](https://developer.chrome.com/blog/devtools-better-angular-debugging/#the-x_google_ignorelist-source-map-extension).
   *
   * By default, it excludes all paths containing `node_modules`. You can pass `false` to
   * disable this behavior, or, for full control, a function that takes the source path and
   * sourcemap path and returns whether to ignore the source path.
   */
  sourcemapIgnoreList?:
    | false
    | ((sourcePath: string, sourcemapPath: string) => boolean);
  /**
   * Backward compatibility. The buildStart and buildEnd hooks were called only once for all
   * environments. This option enables per-environment buildStart and buildEnd hooks.
   * @default false
   * @experimental
   */
  perEnvironmentBuildStartEnd?: boolean;
  /**
   * Run HMR tasks, by default the HMR propagation is done in parallel for all environments
   * @experimental
   */
  hotUpdateEnvironments?: (
    server: ViteDevServer,
    hmr: (environment: DevEnvironment) => Promise<void>
  ) => Promise<void>;
}

export interface ResolvedServerOptions
  extends Omit<ServerOptions, "fs" | "middlewareMode" | "sourcemapIgnoreList"> {
  fs: Required<FileSystemServeOptions>;
  middlewareMode: NonNullable<ServerOptions["middlewareMode"]>;
  sourcemapIgnoreList: Exclude<
    ServerOptions["sourcemapIgnoreList"],
    false | undefined
  >;
}

export interface FileSystemServeOptions {
  /**
   * Strictly restrict file accessing outside of allowing paths.
   *
   * Set to `false` to disable the warning
   *
   * @default true
   */
  strict?: boolean;

  /**
   * Restrict accessing files outside the allowed directories.
   *
   * Accepts absolute path or a path relative to project root.
   * Will try to search up for workspace root by default.
   */
  allow?: string[];

  /**
   * Restrict accessing files that matches the patterns.
   *
   * This will have higher priority than `allow`.
   * picomatch patterns are supported.
   *
   * @default ['.env', '.env.*', '*.crt', '*.pem']
   */
  deny?: string[];

  /**
   * Enable caching of fs calls. It is enabled by default if no custom watch ignored patterns are provided.
   *
   * @experimental
   * @default undefined
   */
  cachedChecks?: boolean;
}

export type ServerHook = (
  this: void,
  server: ViteDevServer
) => (() => void) | void | Promise<(() => void) | void>;

export type HttpServer = http.Server | Http2SecureServer;

export interface ViteDevServer {
  /**
   * The resolved vite config object
   */
  config: ResolvedConfig;
  /**
   * A connect app instance.
   * - Can be used to attach custom middlewares to the dev server.
   * - Can also be used as the handler function of a custom http server
   *   or as a middleware in any connect-style Node.js frameworks
   *
   * https://github.com/senchalabs/connect#use-middleware
   */
  middlewares: Connect.Server;
  /**
   * native Node http server instance
   * will be null in middleware mode
   */
  httpServer: HttpServer | null;
  /**
   * chokidar watcher instance
   * https://github.com/paulmillr/chokidar#api
   */
  watcher: FSWatcher;
  /**
   * web socket server with `send(payload)` method
   */
  ws: WebSocketServer;
  /**
   * HMR broadcaster that can be used to send custom HMR messages to the client
   *
   * Always sends a message to at least a WebSocket client. Any third party can
   * add a channel to the broadcaster to process messages
   */
  hot: HotBroadcaster;
  /**
   * Rollup plugin container that can run plugin hooks on a given file
   */
  pluginContainer: PluginContainer;
  /**
   * Module execution environments attached to the Vite server.
   */
  environments: Record<"client" | "ssr" | (string & {}), DevEnvironment>;
  /**
   * Module graph that tracks the import relationships, url to file mapping
   * and hmr state.
   */
  moduleGraph: ModuleGraph;
  /**
   * The resolved urls Vite prints on the CLI. null in middleware mode or
   * before `server.listen` is called.
   */
  resolvedUrls: ResolvedServerUrls | null;
  /**
   * Programmatically resolve, load and transform a URL and get the result
   * without going through the http request pipeline.
   */
  transformRequest(
    url: string,
    options?: TransformOptions
  ): Promise<TransformResult | null>;
  /**
   * Same as `transformRequest` but only warm up the URLs so the next request
   * will already be cached. The function will never throw as it handles and
   * reports errors internally.
   */
  warmupRequest(url: string, options?: TransformOptions): Promise<void>;
  /**
   * Apply vite built-in HTML transforms and any plugin HTML transforms.
   */
  transformIndexHtml(
    url: string,
    html: string,
    originalUrl?: string
  ): Promise<string>;
  /**
   * Transform module code into SSR format.
   */
  ssrTransform(
    code: string,
    inMap: SourceMap | { mappings: "" } | null,
    url: string,
    originalCode?: string
  ): Promise<TransformResult | null>;
  /**
   * Load a given URL as an instantiated module for SSR.
   */
  ssrLoadModule(
    url: string,
    opts?: { fixStacktrace?: boolean }
  ): Promise<Record<string, any>>;
  /**
   * Returns a fixed version of the given stack
   */
  ssrRewriteStacktrace(stack: string): string;
  /**
   * Mutates the given SSR error by rewriting the stacktrace
   */
  ssrFixStacktrace(e: Error): void;
  /**
   * Triggers HMR for a module in the module graph. You can use the `server.moduleGraph`
   * API to retrieve the module to be reloaded. If `hmr` is false, this is a no-op.
   */
  reloadModule(module: ModuleNode): Promise<void>;
  /**
   * Start the server.
   */
  listen(port?: number, isRestart?: boolean): Promise<ViteDevServer>;
  /**
   * Stop the server.
   */
  close(): Promise<void>;
  /**
   * Print server urls
   */
  printUrls(): void;
  /**
   * Bind CLI shortcuts
   */
  bindCLIShortcuts(options?: BindCLIShortcutsOptions<ViteDevServer>): void;
  /**
   * Restart the server.
   *
   * @param forceOptimize - force the optimizer to re-bundle, same as --force cli flag
   */
  restart(forceOptimize?: boolean): Promise<void>;
  /**
   * Open browser
   */
  openBrowser(): void;
  /**
   * Calling `await server.waitForRequestsIdle(id)` will wait until all static imports
   * are processed. If called from a load or transform plugin hook, the id needs to be
   * passed as a parameter to avoid deadlocks. Calling this function after the first
   * static imports section of the module graph has been processed will resolve immediately.
   */
  waitForRequestsIdle: (ignoredId?: string) => Promise<void>;
  /**
   * @internal
   */
  _setInternalServer(server: ViteDevServer): void;
  /**
   * Left for backward compatibility with VitePress, HMR may not work in some cases
   * but the there will not be a hard error.
   * @internal
   * @deprecated this map is not used anymore
   */
  _importGlobMap: Map<string, { affirmed: string[]; negated: string[] }[]>;
  /**
   * @internal
   */
  _restartPromise: Promise<void> | null;
  /**
   * @internal
   */
  _forceOptimizeOnRestart: boolean;
  /**
   * @internal
   */
  _shortcutsOptions?: BindCLIShortcutsOptions<ViteDevServer>;
  /**
   * @internal
   */
  _currentServerPort?: number | undefined;
  /**
   * @internal
   */
  _configServerPort?: number | undefined;
  /**
   * @internal
   */
  _ssrCompatModuleRunner?: ModuleRunner;
}

export interface ResolvedServerUrls {
  local: string[];
  network: string[];
}

// 创建服务
export function createServer(
  inlineConfig: InlineConfig = {}
): Promise<ViteDevServer> {
  return _createServer(inlineConfig, { hotListen: true });
}

// 创建服务核心
export async function _createServer(
  inlineConfig: InlineConfig = {},
  options: { hotListen: boolean }
): Promise<ViteDevServer> {
  // 解析配置
  const config = await resolveConfig(inlineConfig, "serve");

  // 静态资源服务 文件夹
  const initPublicFilesPromise = initPublicFiles(config);

  const { root, server: serverConfig } = config;
  // 解析后的 https 配置
  const httpsOptions = await resolveHttpsConfig(config.server.https);
  // 中间件模式
  const { middlewareMode } = serverConfig;

  // 文件输出目录
  const resolvedOutDirs = getResolvedOutDirs(
    config.root,
    config.build.outDir,
    config.build.rollupOptions?.output
  );
  // 在构建时要清空的目录
  const emptyOutDir = resolveEmptyOutDir(
    config.build.emptyOutDir,
    config.root,
    resolvedOutDirs
  );
  //
  const resolvedWatchOptions = resolveChokidarOptions(
    {
      disableGlobbing: true,
      ...serverConfig.watch,
    },
    resolvedOutDirs,
    emptyOutDir,
    config.cacheDir
  );

  // 创建中间件
  const middlewares = connect() as Connect.Server;
  // 创建 (http || https || http2)服务
  const httpServer = middlewareMode
    ? null
    : await resolveHttpServer(serverConfig, middlewares, httpsOptions);
  // 创建 ws 服务
  const ws = createWebSocketServer(httpServer, config, httpsOptions);

  const publicFiles = await initPublicFilesPromise;
  const { publicDir } = config;

  if (httpServer) {
    setClientErrorHandler(httpServer, config.logger);
  }

  // 是否启用 watch
  const watchEnabled = serverConfig.watch !== null;
  // 创建 watcher
  const watcher = watchEnabled
    ? (chokidar.watch(
        // config file dependencies and env file might be outside of root
        [
          // 根目录
          root,
          // 配置文件(vite.config.js)中的依赖
          ...config.configFileDependencies,
          // 环境变量文件
          ...getEnvFilesForMode(config.mode, config.envDir),
          // Watch the public directory explicitly because it might be outside
          // of the root directory.
          // 静态资源服务 文件夹
          ...(publicDir && publicFiles ? [publicDir] : []),
        ],
        resolvedWatchOptions
      ) as FSWatcher)
    : createNoopWatcher(resolvedWatchOptions);

  // 环境
  const environments: Record<string, DevEnvironment> = {};
  // 绑定 server.environments
  for (const [name, environmentOptions] of Object.entries(
    config.environments
  )) {
    // 创建 开发环境(DevEnvironment) 的实例
    environments[name] = await environmentOptions.dev.createEnvironment(
      name,
      config,
      {
        ws,
      }
    );
  }
  // server.environments 初始化
  for (const environment of Object.values(environments)) {
    await environment.init({ watcher });
  }

  // Backward compatibility

  // 创建模块图
  let moduleGraph = new ModuleGraph({
    client: () => environments.client.moduleGraph,
    ssr: () => environments.ssr.moduleGraph,
  });
  // 创建 插件容器
  const pluginContainer = createPluginContainer(environments);

  // 关闭http服务函数
  const closeHttpServer = createServerCloseFn(httpServer);

  // html转换函数
  const devHtmlTransformFn = createDevHtmlTransformFn(config);

  // 创建 server 实例
  let server: ViteDevServer = {
    config,
    middlewares,
    httpServer,
    watcher,
    ws,
    hot: createDeprecatedHotBroadcaster(ws),

    environments,
    pluginContainer,
    get moduleGraph() {
      warnFutureDeprecation(config, "removeServerModuleGraph");
      return moduleGraph;
    },
    set moduleGraph(graph) {
      moduleGraph = graph;
    },

    resolvedUrls: null, // will be set on listen
    ssrTransform(
      code: string,
      inMap: SourceMap | { mappings: "" } | null,
      url: string,
      originalCode = code
    ) {
      return ssrTransform(code, inMap, url, originalCode, server.config);
    },
    // environment.transformRequest and .warmupRequest don't take an options param for now,
    // so the logic and error handling needs to be duplicated here.
    // The only param in options that could be important is `html`, but we may remove it as
    // that is part of the internal control flow for the vite dev server to be able to bail
    // out and do the html fallback
    transformRequest(url, options) {
      warnFutureDeprecation(
        config,
        "removeServerTransformRequest",
        "server.transformRequest() is deprecated. Use environment.transformRequest() instead."
      );
      const environment = server.environments[options?.ssr ? "ssr" : "client"];
      return transformRequest(environment, url, options);
    },
    async warmupRequest(url, options) {
      try {
        const environment =
          server.environments[options?.ssr ? "ssr" : "client"];
        await transformRequest(environment, url, options);
      } catch (e) {
        if (
          e?.code === ERR_OUTDATED_OPTIMIZED_DEP ||
          e?.code === ERR_CLOSED_SERVER
        ) {
          // these are expected errors
          return;
        }
        // Unexpected error, log the issue but avoid an unhandled exception
        server.config.logger.error(`Pre-transform error: ${e.message}`, {
          error: e,
          timestamp: true,
        });
      }
    },
    transformIndexHtml(url, html, originalUrl) {
      return devHtmlTransformFn(server, url, html, originalUrl);
    },
    async ssrLoadModule(url, opts?: { fixStacktrace?: boolean }) {
      warnFutureDeprecation(config, "removeSsrLoadModule");
      return ssrLoadModule(url, server, opts?.fixStacktrace);
    },
    ssrFixStacktrace(e) {
      ssrFixStacktrace(e, server.environments.ssr.moduleGraph);
    },
    ssrRewriteStacktrace(stack: string) {
      return ssrRewriteStacktrace(stack, server.environments.ssr.moduleGraph);
    },
    async reloadModule(module) {
      if (serverConfig.hmr !== false && module.file) {
        // TODO: Should we also update the node moduleGraph for backward compatibility?
        const environmentModule = (module._clientModule ?? module._ssrModule)!;
        updateModules(
          environments[environmentModule.environment]!,
          module.file,
          [environmentModule],
          Date.now()
        );
      }
    },
    async listen(port?: number, isRestart?: boolean) {
      await startServer(server, port);
      if (httpServer) {
        server.resolvedUrls = await resolveServerUrls(
          httpServer,
          config.server,
          config
        );
        if (!isRestart && config.server.open) server.openBrowser();
      }
      return server;
    },
    openBrowser() {
      const options = server.config.server;
      const url =
        server.resolvedUrls?.local[0] ?? server.resolvedUrls?.network[0];
      if (url) {
        const path =
          typeof options.open === "string"
            ? new URL(options.open, url).href
            : url;

        // We know the url that the browser would be opened to, so we can
        // start the request while we are awaiting the browser. This will
        // start the crawling of static imports ~500ms before.
        // preTransformRequests needs to be enabled for this optimization.
        if (server.config.server.preTransformRequests) {
          setTimeout(() => {
            const getMethod = path.startsWith("https:") ? httpsGet : httpGet;

            getMethod(
              path,
              {
                headers: {
                  // Allow the history middleware to redirect to /index.html
                  Accept: "text/html",
                },
              },
              (res) => {
                res.on("end", () => {
                  // Ignore response, scripts discovered while processing the entry
                  // will be preprocessed (server.config.server.preTransformRequests)
                });
              }
            )
              .on("error", () => {
                // Ignore errors
              })
              .end();
          }, 0);
        }

        _openBrowser(path, true, server.config.logger);
      } else {
        server.config.logger.warn("No URL available to open in browser");
      }
    },
    async close() {
      if (!middlewareMode) {
        teardownSIGTERMListener(closeServerAndExit);
      }

      await Promise.allSettled([
        watcher.close(),
        ws.close(),
        Promise.allSettled(
          Object.values(server.environments).map((environment) =>
            environment.close()
          )
        ),
        closeHttpServer(),
      ]);
      server.resolvedUrls = null;
    },
    printUrls() {
      if (server.resolvedUrls) {
        printServerUrls(
          server.resolvedUrls,
          serverConfig.host,
          config.logger.info
        );
      } else if (middlewareMode) {
        throw new Error("cannot print server URLs in middleware mode.");
      } else {
        throw new Error(
          "cannot print server URLs before server.listen is called."
        );
      }
    },
    bindCLIShortcuts(options) {
      bindCLIShortcuts(server, options);
    },
    async restart(forceOptimize?: boolean) {
      if (!server._restartPromise) {
        server._forceOptimizeOnRestart = !!forceOptimize;
        server._restartPromise = restartServer(server).finally(() => {
          server._restartPromise = null;
          server._forceOptimizeOnRestart = false;
        });
      }
      return server._restartPromise;
    },

    waitForRequestsIdle(ignoredId?: string): Promise<void> {
      return environments.client.waitForRequestsIdle(ignoredId);
    },

    _setInternalServer(_server: ViteDevServer) {
      // Rebind internal the server variable so functions reference the user
      // server instance after a restart
      server = _server;
    },
    _importGlobMap: new Map(),
    _restartPromise: null,
    _forceOptimizeOnRestart: false,
    _shortcutsOptions: undefined,
  };

  // maintain consistency with the server instance after restarting.
  const reflexServer = new Proxy(server, {
    get: (_, property: keyof ViteDevServer) => {
      return server[property];
    },
    set: (_, property: keyof ViteDevServer, value: never) => {
      server[property] = value;
      return true;
    },
  });

  const closeServerAndExit = async () => {
    try {
      await server.close();
    } finally {
      process.exit();
    }
  };

  if (!middlewareMode) {
    setupSIGTERMListener(closeServerAndExit);
  }

  // 
  const onHMRUpdate = async (
    type: "create" | "delete" | "update",
    file: string
  ) => {
    if (serverConfig.hmr !== false) {
      await handleHMRUpdate(type, file, server);
    }
  };

  // 当 新增 或者 删除文件时
  const onFileAddUnlink = async (file: string, isUnlink: boolean) => {
    file = normalizePath(file);

    await pluginContainer.watchChange(file, {
      event: isUnlink ? "delete" : "create",
    });

    if (publicDir && publicFiles) {
      if (file.startsWith(publicDir)) {
        const path = file.slice(publicDir.length);
        publicFiles[isUnlink ? "delete" : "add"](path);
        if (!isUnlink) {
          const clientModuleGraph = server.environments.client.moduleGraph;
          const moduleWithSamePath = await clientModuleGraph.getModuleByUrl(
            path
          );
          const etag = moduleWithSamePath?.transformResult?.etag;
          if (etag) {
            // The public file should win on the next request over a module with the
            // same path. Prevent the transform etag fast path from serving the module
            clientModuleGraph.etagToModuleMap.delete(etag);
          }
        }
      }
    }
    if (isUnlink) {
      // invalidate module graph cache on file change
      for (const environment of Object.values(server.environments)) {
        environment.moduleGraph.onFileDelete(file);
      }
    }
    await onHMRUpdate(isUnlink ? "delete" : "create", file);
  };

  watcher.on("change", async (file) => {
    file = normalizePath(file);

    await pluginContainer.watchChange(file, { event: "update" });
    // invalidate module graph cache on file change
    for (const environment of Object.values(server.environments)) {
      environment.moduleGraph.onFileChange(file);
    }
    await onHMRUpdate("update", file);
  });

  getFsUtils(config).initWatcher?.(watcher);

  watcher.on("add", (file) => {
    onFileAddUnlink(file, false);
  });
  watcher.on("unlink", (file) => {
    onFileAddUnlink(file, true);
  });

  if (!middlewareMode && httpServer) {
    httpServer.once("listening", () => {
      // update actual port since this may be different from initial value
      serverConfig.port = (httpServer.address() as net.AddressInfo).port;
    });
  }

  // 后置中间件队列
  const postHooks: ((() => void) | void)[] = [];
  // 依次运行插件的 hooks.configureServer 队列
  for (const hook of config.getSortedPluginHooks("configureServer")) {
    postHooks.push(await hook(reflexServer));
  }

  // 使用 中间件
  // 使用 时间中间件
  if (process.env.DEBUG) {
    middlewares.use(timeMiddleware(root));
  }
  // 使用 跨域中间件
  const { cors } = serverConfig;
  if (cors !== false) {
    middlewares.use(corsMiddleware(typeof cors === "boolean" ? {} : cors));
  }
  // 使用 缓存转换中间件
  middlewares.use(cachedTransformMiddleware(server));
  // 使用 代理中间件
  const { proxy } = serverConfig;
  if (proxy) {
    const middlewareServer =
      (isObject(middlewareMode) ? middlewareMode.server : null) || httpServer;
    middlewares.use(proxyMiddleware(middlewareServer, proxy, config));
  }
  // 使用 基础中间件
  if (config.base !== "/") {
    middlewares.use(baseMiddleware(config.rawBase, !!middlewareMode));
  }
  // 使用 打开编辑器中间件
  middlewares.use("/__open-in-editor", launchEditorMiddleware());
  // 使用 ping 请求中间件
  middlewares.use(function viteHMRPingMiddleware(req, res, next) {
    if (req.headers["accept"] === "text/x-vite-ping") {
      res.writeHead(204).end();
    } else {
      next();
    }
  });
  // 使用 公共文件中间件
  if (publicDir) {
    middlewares.use(servePublicMiddleware(server, publicFiles));
  }
  // 使用 转换中间件
  middlewares.use(transformMiddleware(server));
  // 使用 原始文件中间件
  middlewares.use(serveRawFsMiddleware(server));
  // 使用 静态文件中间件
  middlewares.use(serveStaticMiddleware(server));
  // 使用 html 回退中间件
  if (config.appType === "spa" || config.appType === "mpa") {
    middlewares.use(
      htmlFallbackMiddleware(root, config.appType === "spa", getFsUtils(config))
    );
  }
  // 依次运行 后置中间件队列
  postHooks.forEach((fn) => fn && fn());
  // 如果 appType 是 spa 或 mpa，则使用 html 中间件和 404 中间件
  if (config.appType === "spa" || config.appType === "mpa") {
    // 使用 html 中间件
    middlewares.use(indexHtmlMiddleware(root, server));
    // 使用 404 中间件
    middlewares.use(notFoundMiddleware());
  }
  // 使用 错误中间件
  middlewares.use(errorMiddleware(server, !!middlewareMode));

  // httpServer.listen 可以被多次调用
  // 当使用下一个端口时
  // 这段代码是为了避免多次调用 buildStart
  let initingServer: Promise<void> | undefined;
  let serverInited = false;
  const initServer = async () => {
    if (serverInited) return;
    if (initingServer) return initingServer;

    initingServer = (async function () {
      // 为了向后兼容，我们在初始化服务器时调用 buildStart 方法
      // 对于其他环境，buildStart 方法将在第一次请求被转换时调用
      // 并行执行插件队列的 hooks.buildStart 队列
      await environments.client.pluginContainer.buildStart();

      await Promise.all(
        Object.values(server.environments).map((environment) =>
          environment.depsOptimizer?.init()
        )
      );

      // TODO: move warmup call inside environment init()
      warmupFiles(server);
      initingServer = undefined;
      serverInited = true;
    })();
    return initingServer;
  };

  if (!middlewareMode && httpServer) {
    // 重写 listen 方法，在服务器启动之前初始化优化器
    const listen = httpServer.listen.bind(httpServer);
    httpServer.listen = (async (port: number, ...args: any[]) => {
      try {
        // ensure ws server started
        Object.values(environments).forEach((e) => e.hot.listen());
        await initServer();
      } catch (e) {
        httpServer.emit("error", e);
        return;
      }
      return listen(port, ...args);
    }) as any;
  } else {
    if (options.hotListen) {
      Object.values(environments).forEach((e) => e.hot.listen());
    }
    await initServer();
  }

  return server;
}

// 启动服务
async function startServer(
  server: ViteDevServer,
  inlinePort?: number
): Promise<void> {
  const httpServer = server.httpServer;
  if (!httpServer) {
    throw new Error("Cannot call server.listen in middleware mode.");
  }

  const options = server.config.server;
  const hostname = await resolveHostname(options.host);
  const configPort = inlinePort ?? options.port;
  // When using non strict port for the dev server, the running port can be different from the config one.
  // When restarting, the original port may be available but to avoid a switch of URL for the running
  // browser tabs, we enforce the previously used port, expect if the config port changed.
  const port =
    (!configPort || configPort === server._configServerPort
      ? server._currentServerPort
      : configPort) ?? DEFAULT_DEV_PORT;
  server._configServerPort = configPort;

  const serverPort = await httpServerStart(httpServer, {
    port,
    strictPort: options.strictPort,
    host: hostname.host,
    logger: server.config.logger,
  });
  server._currentServerPort = serverPort;
}

// 创建 关闭http服务函数
export function createServerCloseFn(
  server: HttpServer | null
): () => Promise<void> {
  if (!server) {
    return () => Promise.resolve();
  }

  let hasListened = false;
  const openSockets = new Set<net.Socket>();

  server.on("connection", (socket) => {
    openSockets.add(socket);
    socket.on("close", () => {
      openSockets.delete(socket);
    });
  });

  server.once("listening", () => {
    hasListened = true;
  });

  return () =>
    new Promise<void>((resolve, reject) => {
      openSockets.forEach((s) => s.destroy());
      if (hasListened) {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
}

function resolvedAllowDir(root: string, dir: string): string {
  return normalizePath(path.resolve(root, dir));
}

export function resolveServerOptions(
  root: string,
  raw: ServerOptions | undefined,
  logger: Logger
): ResolvedServerOptions {
  const server: ResolvedServerOptions = {
    preTransformRequests: true,
    perEnvironmentBuildStartEnd: false,
    ...(raw as Omit<ResolvedServerOptions, "sourcemapIgnoreList">),
    sourcemapIgnoreList:
      raw?.sourcemapIgnoreList === false
        ? () => false
        : raw?.sourcemapIgnoreList || isInNodeModules,
    middlewareMode: raw?.middlewareMode || false,
  };
  let allowDirs = server.fs?.allow;
  const deny = server.fs?.deny || [".env", ".env.*", "*.{crt,pem}"];

  if (!allowDirs) {
    allowDirs = [searchForWorkspaceRoot(root)];
  }

  if (process.versions.pnp) {
    // running a command fails if cwd doesn't exist and root may not exist
    // search for package root to find a path that exists
    const cwd = searchForPackageRoot(root);
    try {
      const enableGlobalCache =
        execSync("yarn config get enableGlobalCache", { cwd })
          .toString()
          .trim() === "true";
      const yarnCacheDir = execSync(
        `yarn config get ${enableGlobalCache ? "globalFolder" : "cacheFolder"}`,
        { cwd }
      )
        .toString()
        .trim();
      allowDirs.push(yarnCacheDir);
    } catch (e) {
      logger.warn(`Get yarn cache dir error: ${e.message}`, {
        timestamp: true,
      });
    }
  }

  allowDirs = allowDirs.map((i) => resolvedAllowDir(root, i));

  // only push client dir when vite itself is outside-of-root
  const resolvedClientDir = resolvedAllowDir(root, CLIENT_DIR);
  if (!allowDirs.some((dir) => isParentDirectory(dir, resolvedClientDir))) {
    allowDirs.push(resolvedClientDir);
  }

  server.fs = {
    strict: server.fs?.strict ?? true,
    allow: allowDirs,
    deny,
    cachedChecks: server.fs?.cachedChecks,
  };

  if (server.origin?.endsWith("/")) {
    server.origin = server.origin.slice(0, -1);
    logger.warn(
      colors.yellow(
        `${colors.bold("(!)")} server.origin should not end with "/". Using "${
          server.origin
        }" instead.`
      )
    );
  }

  return server;
}

// 重启服务
async function restartServer(server: ViteDevServer) {
  global.__vite_start_time = performance.now();
  const shortcutsOptions = server._shortcutsOptions;

  let inlineConfig = server.config.inlineConfig;
  if (server._forceOptimizeOnRestart) {
    inlineConfig = mergeConfig(inlineConfig, {
      optimizeDeps: {
        force: true,
      },
    });
  }

  // Reinit the server by creating a new instance using the same inlineConfig
  // This will trigger a reload of the config file and re-create the plugins and
  // middlewares. We then assign all properties of the new server to the existing
  // server instance and set the user instance to be used in the new server.
  // This allows us to keep the same server instance for the user.
  {
    let newServer: ViteDevServer | null = null;
    try {
      // delay ws server listen
      newServer = await _createServer(inlineConfig, { hotListen: false });
    } catch (err: any) {
      server.config.logger.error(err.message, {
        timestamp: true,
      });
      server.config.logger.error("server restart failed", { timestamp: true });
      return;
    }

    await server.close();

    // Assign new server props to existing server instance
    const middlewares = server.middlewares;
    newServer._configServerPort = server._configServerPort;
    newServer._currentServerPort = server._currentServerPort;
    Object.assign(server, newServer);

    // Keep the same connect instance so app.use(vite.middlewares) works
    // after a restart in middlewareMode (.route is always '/')
    middlewares.stack = newServer.middlewares.stack;
    server.middlewares = middlewares;

    // Rebind internal server variable so functions reference the user server
    newServer._setInternalServer(server);
  }

  const {
    logger,
    server: { port, middlewareMode },
  } = server.config;
  if (!middlewareMode) {
    await server.listen(port, true);
  } else {
    Object.values(server.environments).forEach((e) => e.hot.listen());
  }
  logger.info("server restarted.", { timestamp: true });

  if (shortcutsOptions) {
    shortcutsOptions.print = false;
    bindCLIShortcuts(server, shortcutsOptions);
  }
}

// 重启服务 并打印URL
export async function restartServerWithUrls(
  server: ViteDevServer
): Promise<void> {
  if (server.config.server.middlewareMode) {
    await server.restart();
    return;
  }

  const { port: prevPort, host: prevHost } = server.config.server;
  const prevUrls = server.resolvedUrls;

  await server.restart();

  const {
    logger,
    server: { port, host },
  } = server.config;
  if (
    (port ?? DEFAULT_DEV_PORT) !== (prevPort ?? DEFAULT_DEV_PORT) ||
    host !== prevHost ||
    diffDnsOrderChange(prevUrls, server.resolvedUrls)
  ) {
    logger.info("");
    server.printUrls();
  }
}
