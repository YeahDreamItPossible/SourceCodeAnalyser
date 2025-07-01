if (!process.env.IS_PUBLISH && !USE_ESM && process.env.BABEL_8_BREAKING) {
  throw new Error(
    "BABEL_8_BREAKING is only supported in ESM. Please run `make use-esm`.",
  );
}

// 版本
export const version = PACKAGE_JSON.version;

// 文件
export { default as File } from "./transformation/file/file.ts";
export type { default as PluginPass } from "./transformation/plugin-pass.ts";
export { default as buildExternalHelpers } from "./tools/build-external-helpers.ts";

// 解析器
import * as resolvers from "./config/files/index.ts";
// 解析插件
export const resolvePlugin = (name: string, dirname: string) =>
  resolvers.resolvePlugin(name, dirname, false).filepath;
// 解析预设
export const resolvePreset = (name: string, dirname: string) =>
  resolvers.resolvePreset(name, dirname, false).filepath;

export { getEnv } from "./config/helpers/environment.ts";

// NOTE: Lazy re-exports aren't detected by the Node.js CJS-ESM interop.
// These are handled by pluginInjectNodeReexportsHints in our babel.config.js
// so that they can work well.
export * as types from "@babel/types";
export { tokTypes } from "@babel/parser";
// 遍历
export { default as traverse } from "@babel/traverse";
// 模版
export { default as template } from "@babel/template";

// rollup-plugin-dts assumes that all re-exported types are also valid values
// Visitor is only a type, so we need to use this workaround to prevent
// rollup-plugin-dts from breaking it.
// TODO: Figure out how to fix this upstream.
export type { NodePath, Scope } from "@babel/traverse";
export type Visitor<S = unknown> = import("@babel/traverse").Visitor<S>;

// 创建配置项
export {
  createConfigItem,
  createConfigItemAsync,
  createConfigItemSync,
} from "./config/index.ts";

// 加载选项
export {
  loadOptions,
  loadOptionsAsync,
  loadPartialConfig,
  loadPartialConfigAsync,
  loadPartialConfigSync,
} from "./config/index.ts";
import { loadOptionsSync } from "./config/index.ts";
export { loadOptionsSync };

export type {
  CallerMetadata,
  ConfigItem,
  InputOptions,
  PluginAPI,
  PluginObject,
  PresetAPI,
  PresetObject,
} from "./config/index.ts";

// 代码转换
export {
  type FileResult,
  transform,
  transformAsync,
  transformSync,
} from "./transform.ts";
// 文件转换
export {
  transformFile,
  transformFileAsync,
  transformFileSync,
} from "./transform-file.ts";
// AST转换
export {
  transformFromAst,
  transformFromAstAsync,
  transformFromAstSync,
} from "./transform-ast.ts";
// 解析
export { parse, parseAsync, parseSync } from "./parse.ts";

// 扩展名
export const DEFAULT_EXTENSIONS = Object.freeze([
  ".js",
  ".jsx",
  ".es6",
  ".es",
  ".mjs",
  ".cjs",
] as const);

import Module from "module" with { if: "USE_ESM && !IS_STANDALONE" };
import * as thisFile from "./index.ts" with { if: "USE_ESM && !IS_STANDALONE" };
if (USE_ESM && !IS_STANDALONE) {
  // Pass this module to the CJS proxy, so that it can be synchronously accessed.
  const cjsProxy = Module.createRequire(import.meta.url)("../cjs-proxy.cjs");
  cjsProxy["__ initialize @babel/core cjs proxy __"] = thisFile;
}

if (!process.env.BABEL_8_BREAKING && !USE_ESM) {
  // For easier backward-compatibility, provide an API like the one we exposed in Babel 6.
  // eslint-disable-next-line no-restricted-globals
  exports.OptionManager = class OptionManager {
    init(opts: any) {
      return loadOptionsSync(opts);
    }
  };

  // eslint-disable-next-line no-restricted-globals
  exports.Plugin = function Plugin(alias: string) {
    throw new Error(
      `The (${alias}) Babel 5 plugin is being run with an unsupported Babel version.`,
    );
  };
}
