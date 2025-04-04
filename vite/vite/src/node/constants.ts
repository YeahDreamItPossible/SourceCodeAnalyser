import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import type { RollupPluginHooks } from "./typeUtils";

const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url)).toString()
);

export const ROLLUP_HOOKS = [
  "options",
  "buildStart",
  "buildEnd",
  "renderStart",
  "renderError",
  "renderChunk",
  "writeBundle",
  "generateBundle",
  "banner",
  "footer",
  "augmentChunkHash",
  "outputOptions",
  "renderDynamicImport",
  "resolveFileUrl",
  "resolveImportMeta",
  "intro",
  "outro",
  "closeBundle",
  "closeWatcher",
  "load",
  "moduleParsed",
  "watchChange",
  "resolveDynamicImport",
  "resolveId",
  "shouldTransformCachedModule",
  "transform",
  "onLog",
] satisfies RollupPluginHooks[];

export const VERSION = version as string;

export const DEFAULT_MAIN_FIELDS = [
  "browser",
  "module",
  "jsnext:main", // moment still uses this...
  "jsnext",
];

// Baseline support browserslist
// "defaults and supports es6-module and supports es6-module-dynamic-import"
// Higher browser versions may be needed for extra features.
export const ESBUILD_MODULES_TARGET = [
  "es2020", // support import.meta.url
  "edge88",
  "firefox78",
  "chrome87",
  "safari14",
];

export const DEFAULT_EXTENSIONS = [
  ".mjs",
  ".js",
  ".mts",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
];

export const DEFAULT_CONFIG_FILES = [
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "vite.config.cjs",
  "vite.config.mts",
  "vite.config.cts",
];

export const JS_TYPES_RE = /\.(?:j|t)sx?$|\.mjs$/;

// css正则
export const CSS_LANGS_RE =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;

export const OPTIMIZABLE_ENTRY_RE = /\.[cm]?[jt]s$/;
//
export const SPECIAL_QUERY_RE = /[?&](?:worker|sharedworker|raw|url)\b/;

/**
 * Prefix for resolved fs paths, since windows paths may not be valid as URLs.
 */
export const FS_PREFIX = `/@fs/`;

export const CLIENT_PUBLIC_PATH = `/@vite/client`;
export const ENV_PUBLIC_PATH = `/@vite/env`;
export const VITE_PACKAGE_DIR = resolve(
  // import.meta.url is `dist/node/constants.js` after bundle
  fileURLToPath(import.meta.url),
  "../../.."
);

export const CLIENT_ENTRY = resolve(VITE_PACKAGE_DIR, "dist/client/client.mjs");
export const ENV_ENTRY = resolve(VITE_PACKAGE_DIR, "dist/client/env.mjs");
export const CLIENT_DIR = path.dirname(CLIENT_ENTRY);

// ** READ THIS ** before editing `KNOWN_ASSET_TYPES`.
//   If you add an asset to `KNOWN_ASSET_TYPES`, make sure to also add it
//   to the TypeScript declaration file `packages/vite/client.d.ts` and
//   add a mime type to the `registerCustomMime` in
//   `packages/vite/src/node/plugin/assets.ts` if mime type cannot be
//   looked up by mrmime.
export const KNOWN_ASSET_TYPES = [
  // images
  "apng",
  "bmp",
  "png",
  "jpe?g",
  "jfif",
  "pjpeg",
  "pjp",
  "gif",
  "svg",
  "ico",
  "webp",
  "avif",

  // media
  "mp4",
  "webm",
  "ogg",
  "mp3",
  "wav",
  "flac",
  "aac",
  "opus",
  "mov",
  "m4a",
  "vtt",

  // fonts
  "woff2?",
  "eot",
  "ttf",
  "otf",

  // other
  "webmanifest",
  "pdf",
  "txt",
];

export const DEFAULT_ASSETS_RE = new RegExp(
  `\\.(` + KNOWN_ASSET_TYPES.join("|") + `)(\\?.*)?$`
);

export const DEP_VERSION_RE = /[?&](v=[\w.-]+)\b/;

export const loopbackHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0000:0000:0000:0000:0000:0000:0000:0001",
]);
export const wildcardHosts = new Set([
  "0.0.0.0",
  "::",
  "0000:0000:0000:0000:0000:0000:0000:0000",
]);

export const DEFAULT_DEV_PORT = 5173;

export const DEFAULT_PREVIEW_PORT = 4173;

export const DEFAULT_ASSETS_INLINE_LIMIT = 4096;

export const METADATA_FILENAME = "_metadata.json";

export const ERR_OPTIMIZE_DEPS_PROCESSING_ERROR =
  "ERR_OPTIMIZE_DEPS_PROCESSING_ERROR";
export const ERR_OUTDATED_OPTIMIZED_DEP = "ERR_OUTDATED_OPTIMIZED_DEP";
export const ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR =
  "ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR";
