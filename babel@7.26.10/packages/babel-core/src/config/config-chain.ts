/* eslint-disable @typescript-eslint/no-use-before-define */
import path from "path";
import buildDebug from "debug";
import type { Handler } from "gensync";
import { validate } from "./validation/options.ts";
import type {
  ValidatedOptions,
  IgnoreList,
  ConfigApplicableTest,
  BabelrcSearch,
  CallerMetadata,
  IgnoreItem,
} from "./validation/options.ts";
import pathPatternToRegex from "./pattern-to-regex.ts";
import { ConfigPrinter, ChainFormatter } from "./printer.ts";
import type { ReadonlyDeepArray } from "./helpers/deep-array.ts";

import { endHiddenCallStack } from "../errors/rewrite-stack-trace.ts";
import ConfigError from "../errors/config-error.ts";
import type { PluginAPI, PresetAPI } from "./helpers/config-api.ts";

const debug = buildDebug("babel:config:config-chain");

import {
  findPackageData,
  findRelativeConfig,
  findRootConfig,
  loadConfig,
} from "./files/index.ts";
import type { ConfigFile, IgnoreFile, FilePackageData } from "./files/index.ts";

import { makeWeakCacheSync, makeStrongCacheSync } from "./caching.ts";

import {
  createCachedDescriptors,
  createUncachedDescriptors,
} from "./config-descriptors.ts";
import type {
  UnloadedDescriptor,
  OptionsAndDescriptors,
  ValidatedFile,
} from "./config-descriptors.ts";

// 配置链基础结构
export type ConfigChain = {
  // 插件描述符数组
  plugins: Array<UnloadedDescriptor<PluginAPI>>;
  // 预设描述符数组
  presets: Array<UnloadedDescriptor<PresetAPI>>;
  // 选项数组
  options: Array<ValidatedOptions>;
  // 文件路径集合
  files: Set<string>;
};

// 预设实例结构
export type PresetInstance = {
  // 选项
  options: ValidatedOptions;
  // 预设别名
  alias: string;
  // 目录路径
  dirname: string;
  // 外部依赖
  externalDependencies: ReadonlyDeepArray<string>;
};

// 配置上下文
export type ConfigContext = {
  // 文件名
  filename: string | undefined;
  // 当前工作目录
  cwd: string;
  // 根目录
  root: string;
  // 环境名
  envName: string;
  // 调用者元数据
  caller: CallerMetadata | undefined;
  // 是否显示配置
  showConfig: boolean;
};

// 构建 预设配置链
export function* buildPresetChain(
  arg: PresetInstance,
  context: any,
): Handler<ConfigChain | null> {
  const chain = yield* buildPresetChainWalker(arg, context);
  if (!chain) return null;

  return {
    plugins: dedupDescriptors(chain.plugins),
    presets: dedupDescriptors(chain.presets),
    options: chain.options.map(o => normalizeOptions(o)),
    files: new Set(),
  };
}

// 构建 预设配置链遍历器
export const buildPresetChainWalker = makeChainWalker<PresetInstance>({
  root: preset => loadPresetDescriptors(preset),
  env: (preset, envName) => loadPresetEnvDescriptors(preset)(envName),
  overrides: (preset, index) => loadPresetOverridesDescriptors(preset)(index),
  overridesEnv: (preset, index, envName) =>
    loadPresetOverridesEnvDescriptors(preset)(index)(envName),
  createLogger: () => () => {}, // Currently we don't support logging how preset is expanded
});
// 加载预设描述符
const loadPresetDescriptors = makeWeakCacheSync((preset: PresetInstance) =>
  buildRootDescriptors(preset, preset.alias, createUncachedDescriptors),
);
// 加载预设环境特定描述符
const loadPresetEnvDescriptors = makeWeakCacheSync((preset: PresetInstance) =>
  makeStrongCacheSync((envName: string) =>
    buildEnvDescriptors(
      preset,
      preset.alias,
      createUncachedDescriptors,
      envName,
    ),
  ),
);
// 加载预设覆盖描述符
const loadPresetOverridesDescriptors = makeWeakCacheSync(
  (preset: PresetInstance) =>
    makeStrongCacheSync((index: number) =>
      buildOverrideDescriptors(
        preset,
        preset.alias,
        createUncachedDescriptors,
        index,
      ),
    ),
);
const loadPresetOverridesEnvDescriptors = makeWeakCacheSync(
  (preset: PresetInstance) =>
    makeStrongCacheSync((index: number) =>
      makeStrongCacheSync((envName: string) =>
        buildOverrideEnvDescriptors(
          preset,
          preset.alias,
          createUncachedDescriptors,
          index,
          envName,
        ),
      ),
    ),
);

export type FileHandling = "transpile" | "ignored" | "unsupported";
export type RootConfigChain = ConfigChain & {
  babelrc: ConfigFile | void;
  config: ConfigFile | void;
  ignore: IgnoreFile | void;
  fileHandling: FileHandling;
  files: Set<string>;
};

// 构建根配置链
export function* buildRootChain(
  opts: ValidatedOptions,
  context: ConfigContext,
): Handler<RootConfigChain | null> {
  let configReport, babelRcReport;
  // / 创建程序化日志记录器
  const programmaticLogger = new ConfigPrinter();
  // 加载程序化配置链
  const programmaticChain = yield* loadProgrammaticChain(
    {
      options: opts,
      dirname: context.cwd,
    },
    context,
    undefined,
    programmaticLogger,
  );
  if (!programmaticChain) return null;
  // 获取程序化配置报告
  const programmaticReport = yield* programmaticLogger.output();

  // 处理配置文件
  let configFile;
  if (typeof opts.configFile === "string") {
    configFile = yield* loadConfig(
      opts.configFile,
      context.cwd,
      context.envName,
      context.caller,
    );
  } else if (opts.configFile !== false) {
    configFile = yield* findRootConfig(
      context.root,
      context.envName,
      context.caller,
    );
  }

  let { babelrc, babelrcRoots } = opts;
  let babelrcRootsDirectory = context.cwd;

  const configFileChain = emptyChain();
  const configFileLogger = new ConfigPrinter();
  if (configFile) {
    const validatedFile = validateConfigFile(configFile);
    const result = yield* loadFileChain(
      validatedFile,
      context,
      undefined,
      configFileLogger,
    );
    if (!result) return null;
    configReport = yield* configFileLogger.output();

    // Allow config files to toggle `.babelrc` resolution on and off and
    // specify where the roots are.
    if (babelrc === undefined) {
      babelrc = validatedFile.options.babelrc;
    }
    if (babelrcRoots === undefined) {
      babelrcRootsDirectory = validatedFile.dirname;
      babelrcRoots = validatedFile.options.babelrcRoots;
    }

    mergeChain(configFileChain, result);
  }

  let ignoreFile, babelrcFile;
  let isIgnored = false;
  const fileChain = emptyChain();
  // resolve all .babelrc files
  if (
    (babelrc === true || babelrc === undefined) &&
    typeof context.filename === "string"
  ) {
    const pkgData = yield* findPackageData(context.filename);

    if (
      pkgData &&
      babelrcLoadEnabled(context, pkgData, babelrcRoots, babelrcRootsDirectory)
    ) {
      ({ ignore: ignoreFile, config: babelrcFile } = yield* findRelativeConfig(
        pkgData,
        context.envName,
        context.caller,
      ));

      if (ignoreFile) {
        fileChain.files.add(ignoreFile.filepath);
      }

      if (
        ignoreFile &&
        shouldIgnore(context, ignoreFile.ignore, null, ignoreFile.dirname)
      ) {
        isIgnored = true;
      }

      if (babelrcFile && !isIgnored) {
        const validatedFile = validateBabelrcFile(babelrcFile);
        const babelrcLogger = new ConfigPrinter();
        const result = yield* loadFileChain(
          validatedFile,
          context,
          undefined,
          babelrcLogger,
        );
        if (!result) {
          isIgnored = true;
        } else {
          babelRcReport = yield* babelrcLogger.output();
          mergeChain(fileChain, result);
        }
      }

      if (babelrcFile && isIgnored) {
        fileChain.files.add(babelrcFile.filepath);
      }
    }
  }

  if (context.showConfig) {
    console.log(
      `Babel configs on "${context.filename}" (ascending priority):\n` +
        // print config by the order of ascending priority
        [configReport, babelRcReport, programmaticReport]
          .filter(x => !!x)
          .join("\n\n") +
        "\n-----End Babel configs-----",
    );
  }
  // Insert file chain in front so programmatic options have priority
  // over configuration file chain items.
  const chain = mergeChain(
    mergeChain(mergeChain(emptyChain(), configFileChain), fileChain),
    programmaticChain,
  );

  return {
    // 插件
    plugins: isIgnored ? [] : dedupDescriptors(chain.plugins),
    // 预设
    presets: isIgnored ? [] : dedupDescriptors(chain.presets),
    // 选项
    options: isIgnored ? [] : chain.options.map(o => normalizeOptions(o)),
    // 
    fileHandling: isIgnored ? "ignored" : "transpile",
    // 忽视文件内容
    ignore: ignoreFile || undefined,
    // babelrc 文件内容
    babelrc: babelrcFile || undefined,
    // 配置文件内容
    config: configFile || undefined,
    // 文件
    files: chain.files,
  };
}

function babelrcLoadEnabled(
  context: ConfigContext,
  pkgData: FilePackageData,
  babelrcRoots: BabelrcSearch | undefined,
  babelrcRootsDirectory: string,
): boolean {
  if (typeof babelrcRoots === "boolean") return babelrcRoots;

  const absoluteRoot = context.root;

  // Fast path to avoid having to match patterns if the babelrc is just
  // loading in the standard root directory.
  if (babelrcRoots === undefined) {
    return pkgData.directories.includes(absoluteRoot);
  }

  let babelrcPatterns = babelrcRoots;
  if (!Array.isArray(babelrcPatterns)) {
    babelrcPatterns = [babelrcPatterns as IgnoreItem];
  }
  babelrcPatterns = babelrcPatterns.map(pat => {
    return typeof pat === "string"
      ? path.resolve(babelrcRootsDirectory, pat)
      : pat;
  });

  // Fast path to avoid having to match patterns if the babelrc is just
  // loading in the standard root directory.
  if (babelrcPatterns.length === 1 && babelrcPatterns[0] === absoluteRoot) {
    return pkgData.directories.includes(absoluteRoot);
  }

  return babelrcPatterns.some(pat => {
    if (typeof pat === "string") {
      pat = pathPatternToRegex(pat, babelrcRootsDirectory);
    }

    return pkgData.directories.some(directory => {
      return matchPattern(pat, babelrcRootsDirectory, directory, context);
    });
  });
}

// 验证配置文件有效性
const validateConfigFile = makeWeakCacheSync(
  (file: ConfigFile): ValidatedFile => ({
    filepath: file.filepath,
    dirname: file.dirname,
    options: validate("configfile", file.options, file.filepath),
  }),
);

// 验证 bablrc文件有效性
const validateBabelrcFile = makeWeakCacheSync(
  (file: ConfigFile): ValidatedFile => ({
    filepath: file.filepath,
    dirname: file.dirname,
    options: validate("babelrcfile", file.options, file.filepath),
  }),
);

// 
const validateExtendFile = makeWeakCacheSync(
  (file: ConfigFile): ValidatedFile => ({
    filepath: file.filepath,
    dirname: file.dirname,
    options: validate("extendsfile", file.options, file.filepath),
  }),
);

// 加载 程序配置链
const loadProgrammaticChain = makeChainWalker({
  root: input => buildRootDescriptors(input, "base", createCachedDescriptors),
  env: (input, envName) =>
    buildEnvDescriptors(input, "base", createCachedDescriptors, envName),
  overrides: (input, index) =>
    buildOverrideDescriptors(input, "base", createCachedDescriptors, index),
  overridesEnv: (input, index, envName) =>
    buildOverrideEnvDescriptors(
      input,
      "base",
      createCachedDescriptors,
      index,
      envName,
    ),
  createLogger: (input, context, baseLogger) =>
    buildProgrammaticLogger(input, context, baseLogger),
});

/**
 * Build a config chain for a given file.
 */
const loadFileChainWalker = makeChainWalker<ValidatedFile>({
  root: file => loadFileDescriptors(file),
  env: (file, envName) => loadFileEnvDescriptors(file)(envName),
  overrides: (file, index) => loadFileOverridesDescriptors(file)(index),
  overridesEnv: (file, index, envName) =>
    loadFileOverridesEnvDescriptors(file)(index)(envName),
  createLogger: (file, context, baseLogger) =>
    buildFileLogger(file.filepath, context, baseLogger),
});

function* loadFileChain(
  input: ValidatedFile,
  context: ConfigContext,
  files: Set<ConfigFile>,
  baseLogger: ConfigPrinter,
) {
  const chain = yield* loadFileChainWalker(input, context, files, baseLogger);
  chain?.files.add(input.filepath);

  return chain;
}

const loadFileDescriptors = makeWeakCacheSync((file: ValidatedFile) =>
  buildRootDescriptors(file, file.filepath, createUncachedDescriptors),
);
const loadFileEnvDescriptors = makeWeakCacheSync((file: ValidatedFile) =>
  makeStrongCacheSync((envName: string) =>
    buildEnvDescriptors(
      file,
      file.filepath,
      createUncachedDescriptors,
      envName,
    ),
  ),
);
const loadFileOverridesDescriptors = makeWeakCacheSync((file: ValidatedFile) =>
  makeStrongCacheSync((index: number) =>
    buildOverrideDescriptors(
      file,
      file.filepath,
      createUncachedDescriptors,
      index,
    ),
  ),
);
const loadFileOverridesEnvDescriptors = makeWeakCacheSync(
  (file: ValidatedFile) =>
    makeStrongCacheSync((index: number) =>
      makeStrongCacheSync((envName: string) =>
        buildOverrideEnvDescriptors(
          file,
          file.filepath,
          createUncachedDescriptors,
          index,
          envName,
        ),
      ),
    ),
);

function buildFileLogger(
  filepath: string,
  context: ConfigContext,
  baseLogger: ConfigPrinter | void,
) {
  if (!baseLogger) {
    return () => {};
  }
  return baseLogger.configure(context.showConfig, ChainFormatter.Config, {
    filepath,
  });
}

// 构建 根描述符
function buildRootDescriptors(
  { dirname, options }: Partial<ValidatedFile>,
  alias: string,
  descriptors: (
    dirname: string,
    options: ValidatedOptions,
    alias: string,
  ) => OptionsAndDescriptors,
) {
  return descriptors(dirname, options, alias);
}

function buildProgrammaticLogger(
  _: unknown,
  context: ConfigContext,
  baseLogger: ConfigPrinter | void,
) {
  if (!baseLogger) {
    return () => {};
  }
  return baseLogger.configure(context.showConfig, ChainFormatter.Programmatic, {
    callerName: context.caller?.name,
  });
}

function buildEnvDescriptors(
  { dirname, options }: Partial<ValidatedFile>,
  alias: string,
  descriptors: (
    dirname: string,
    options: ValidatedOptions,
    alias: string,
  ) => OptionsAndDescriptors,
  envName: string,
) {
  const opts = options.env?.[envName];
  return opts ? descriptors(dirname, opts, `${alias}.env["${envName}"]`) : null;
}

function buildOverrideDescriptors(
  { dirname, options }: Partial<ValidatedFile>,
  alias: string,
  descriptors: (
    dirname: string,
    options: ValidatedOptions,
    alias: string,
  ) => OptionsAndDescriptors,
  index: number,
) {
  const opts = options.overrides?.[index];
  if (!opts) throw new Error("Assertion failure - missing override");

  return descriptors(dirname, opts, `${alias}.overrides[${index}]`);
}

function buildOverrideEnvDescriptors(
  { dirname, options }: Partial<ValidatedFile>,
  alias: string,
  descriptors: (
    dirname: string,
    options: ValidatedOptions,
    alias: string,
  ) => OptionsAndDescriptors,
  index: number,
  envName: string,
) {
  const override = options.overrides?.[index];
  if (!override) throw new Error("Assertion failure - missing override");

  const opts = override.env?.[envName];
  return opts
    ? descriptors(
        dirname,
        opts,
        `${alias}.overrides[${index}].env["${envName}"]`,
      )
    : null;
}

// 制造 配置链遍历器
function makeChainWalker<
  ArgT extends {
    options: ValidatedOptions;
    dirname: string;
    filepath?: string;
  },
>({
  root,
  env,
  overrides,
  overridesEnv,
  createLogger,
}: {
  root: (configEntry: ArgT) => OptionsAndDescriptors;
  env: (configEntry: ArgT, env: string) => OptionsAndDescriptors | null;
  overrides: (configEntry: ArgT, index: number) => OptionsAndDescriptors;
  overridesEnv: (
    configEntry: ArgT,
    index: number,
    env: string,
  ) => OptionsAndDescriptors | null;
  createLogger: (
    configEntry: ArgT,
    context: ConfigContext,
    printer: ConfigPrinter | void,
  ) => (
    opts: OptionsAndDescriptors,
    index?: number | null,
    env?: string | null,
  ) => void;
}): (
  configEntry: ArgT,
  context: ConfigContext,
  files?: Set<ConfigFile>,
  baseLogger?: ConfigPrinter,
) => Handler<ConfigChain | null> {
  return function* chainWalker(input, context, files = new Set(), baseLogger) {
    const { dirname } = input;

    const flattenedConfigs: Array<{
      config: OptionsAndDescriptors;
      index: number | undefined | null;
      envName: string | undefined | null;
    }> = [];

    const rootOpts = root(input);
    if (configIsApplicable(rootOpts, dirname, context, input.filepath)) {
      flattenedConfigs.push({
        config: rootOpts,
        envName: undefined,
        index: undefined,
      });

      const envOpts = env(input, context.envName);
      if (
        envOpts &&
        configIsApplicable(envOpts, dirname, context, input.filepath)
      ) {
        flattenedConfigs.push({
          config: envOpts,
          envName: context.envName,
          index: undefined,
        });
      }

      (rootOpts.options.overrides || []).forEach((_, index) => {
        const overrideOps = overrides(input, index);
        if (configIsApplicable(overrideOps, dirname, context, input.filepath)) {
          flattenedConfigs.push({
            config: overrideOps,
            index,
            envName: undefined,
          });

          const overrideEnvOpts = overridesEnv(input, index, context.envName);
          if (
            overrideEnvOpts &&
            configIsApplicable(
              overrideEnvOpts,
              dirname,
              context,
              input.filepath,
            )
          ) {
            flattenedConfigs.push({
              config: overrideEnvOpts,
              index,
              envName: context.envName,
            });
          }
        }
      });
    }

    // Process 'ignore' and 'only' before 'extends' items are processed so
    // that we don't do extra work loading extended configs if a file is
    // ignored.
    if (
      flattenedConfigs.some(
        ({
          config: {
            options: { ignore, only },
          },
        }) => shouldIgnore(context, ignore, only, dirname),
      )
    ) {
      return null;
    }

    const chain = emptyChain();
    const logger = createLogger(input, context, baseLogger);

    for (const { config, index, envName } of flattenedConfigs) {
      if (
        !(yield* mergeExtendsChain(
          chain,
          config.options,
          dirname,
          context,
          files,
          baseLogger,
        ))
      ) {
        return null;
      }

      logger(config, index, envName);
      yield* mergeChainOpts(chain, config);
    }
    return chain;
  };
}

function* mergeExtendsChain(
  chain: ConfigChain,
  opts: ValidatedOptions,
  dirname: string,
  context: ConfigContext,
  files: Set<ConfigFile>,
  baseLogger?: ConfigPrinter,
): Handler<boolean> {
  if (opts.extends === undefined) return true;

  const file = yield* loadConfig(
    opts.extends,
    dirname,
    context.envName,
    context.caller,
  );

  if (files.has(file)) {
    throw new Error(
      `Configuration cycle detected loading ${file.filepath}.\n` +
        `File already loaded following the config chain:\n` +
        Array.from(files, file => ` - ${file.filepath}`).join("\n"),
    );
  }

  files.add(file);
  const fileChain = yield* loadFileChain(
    validateExtendFile(file),
    context,
    files,
    baseLogger,
  );
  files.delete(file);

  if (!fileChain) return false;

  mergeChain(chain, fileChain);

  return true;
}

// 合并 链配置
function mergeChain(target: ConfigChain, source: ConfigChain): ConfigChain {
  target.options.push(...source.options);
  target.plugins.push(...source.plugins);
  target.presets.push(...source.presets);
  for (const file of source.files) {
    target.files.add(file);
  }

  return target;
}

// 合并 链配置选项
function* mergeChainOpts(
  target: ConfigChain,
  { options, plugins, presets }: OptionsAndDescriptors,
): Handler<ConfigChain> {
  target.options.push(options);
  target.plugins.push(...(yield* plugins()));
  target.presets.push(...(yield* presets()));

  return target;
}

// 创建空配置链
function emptyChain(): ConfigChain {
  return {
    options: [], // 选项
    presets: [], // 预设
    plugins: [], // 插件
    files: new Set(), // 文件
  };
}

function normalizeOptions(opts: ValidatedOptions): ValidatedOptions {
  const options = {
    ...opts,
  };
  delete options.extends;
  delete options.env;
  delete options.overrides;
  delete options.plugins;
  delete options.presets;
  delete options.passPerPreset;
  delete options.ignore;
  delete options.only;
  delete options.test;
  delete options.include;
  delete options.exclude;

  // "sourceMap" is just aliased to sourceMap, so copy it over as
  // we merge the options together.
  if (Object.hasOwn(options, "sourceMap")) {
    options.sourceMaps = options.sourceMap;
    delete options.sourceMap;
  }
  return options;
}

// 
function dedupDescriptors<API>(
  items: Array<UnloadedDescriptor<API>>,
): Array<UnloadedDescriptor<API>> {
  const map: Map<
    Function,
    Map<string | void, { value: UnloadedDescriptor<API> }>
  > = new Map();

  const descriptors = [];

  for (const item of items) {
    if (typeof item.value === "function") {
      const fnKey = item.value;
      let nameMap = map.get(fnKey);
      if (!nameMap) {
        nameMap = new Map();
        map.set(fnKey, nameMap);
      }
      let desc = nameMap.get(item.name);
      if (!desc) {
        desc = { value: item };
        descriptors.push(desc);

        // Treat passPerPreset presets as unique, skipping them
        // in the merge processing steps.
        if (!item.ownPass) nameMap.set(item.name, desc);
      } else {
        desc.value = item;
      }
    } else {
      descriptors.push({ value: item });
    }
  }

  return descriptors.reduce((acc, desc) => {
    acc.push(desc.value);
    return acc;
  }, []);
}

// 配置是否可用
function configIsApplicable(
  { options }: OptionsAndDescriptors,
  dirname: string,
  context: ConfigContext,
  configName: string,
): boolean {
  return (
    (options.test === undefined ||
      configFieldIsApplicable(context, options.test, dirname, configName)) &&
    (options.include === undefined ||
      configFieldIsApplicable(context, options.include, dirname, configName)) &&
    (options.exclude === undefined ||
      !configFieldIsApplicable(context, options.exclude, dirname, configName))
  );
}

// 配置文件是否可用
function configFieldIsApplicable(
  context: ConfigContext,
  test: ConfigApplicableTest,
  dirname: string,
  configName: string,
): boolean {
  const patterns = Array.isArray(test) ? test : [test];

  return matchesPatterns(context, patterns, dirname, configName);
}

/**
 * Print the ignoreList-values in a more helpful way than the default.
 */
function ignoreListReplacer(
  _key: string,
  value: IgnoreList | IgnoreItem,
): IgnoreList | IgnoreItem | string {
  if (value instanceof RegExp) {
    return String(value);
  }

  return value;
}

/**
 * Tests if a filename should be ignored based on "ignore" and "only" options.
 */
function shouldIgnore(
  context: ConfigContext,
  ignore: IgnoreList | undefined | null,
  only: IgnoreList | undefined | null,
  dirname: string,
): boolean {
  if (ignore && matchesPatterns(context, ignore, dirname)) {
    const message = `No config is applied to "${
      context.filename ?? "(unknown)"
    }" because it matches one of \`ignore: ${JSON.stringify(
      ignore,
      ignoreListReplacer,
    )}\` from "${dirname}"`;
    debug(message);
    if (context.showConfig) {
      console.log(message);
    }
    return true;
  }

  if (only && !matchesPatterns(context, only, dirname)) {
    const message = `No config is applied to "${
      context.filename ?? "(unknown)"
    }" because it fails to match one of \`only: ${JSON.stringify(
      only,
      ignoreListReplacer,
    )}\` from "${dirname}"`;
    debug(message);
    if (context.showConfig) {
      console.log(message);
    }
    return true;
  }

  return false;
}

/**
 * Returns result of calling function with filename if pattern is a function.
 * Otherwise returns result of matching pattern Regex with filename.
 */
function matchesPatterns(
  context: ConfigContext,
  patterns: IgnoreList,
  dirname: string,
  configName?: string,
): boolean {
  return patterns.some(pattern =>
    matchPattern(pattern, dirname, context.filename, context, configName),
  );
}

// 匹配模式
function matchPattern(
  pattern: IgnoreItem,
  dirname: string,
  pathToTest: string | undefined,
  context: ConfigContext,
  configName?: string,
): boolean {
  if (typeof pattern === "function") {
    return !!endHiddenCallStack(pattern)(pathToTest, {
      dirname,
      envName: context.envName,
      caller: context.caller,
    });
  }

  if (typeof pathToTest !== "string") {
    throw new ConfigError(
      `Configuration contains string/RegExp pattern, but no filename was passed to Babel`,
      configName,
    );
  }

  if (typeof pattern === "string") {
    pattern = pathPatternToRegex(pattern, dirname);
  }
  return pattern.test(pathToTest);
}
