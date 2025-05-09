import { EventEmitter } from "node:events";
import path from "node:path";
import glob from "fast-glob";
import type { FSWatcher, WatchOptions } from "dep-types/chokidar";
import type { OutputOptions } from "rollup";
import colors from "picocolors";
import { withTrailingSlash } from "../shared/utils";
import { arraify, normalizePath } from "./utils";
import type { Logger } from "./logger";

// 以 Set 返回解析后的输出文件目录(绝对路径)
export function getResolvedOutDirs(
  root: string,
  outDir: string,
  outputOptions: OutputOptions[] | OutputOptions | undefined
): Set<string> {
  const resolvedOutDir = path.resolve(root, outDir);
  if (!outputOptions) return new Set([resolvedOutDir]);

  return new Set(
    arraify(outputOptions).map(({ dir }) =>
      dir ? path.resolve(root, dir) : resolvedOutDir
    )
  );
}

// 默认情况下， 构建后的文件 只能在 当前根目录 路径下
export function resolveEmptyOutDir(
  emptyOutDir: boolean | null,
  root: string,
  outDirs: Set<string>,
  logger?: Logger
): boolean {
  if (emptyOutDir != null) return emptyOutDir;

  for (const outDir of outDirs) {
    if (!normalizePath(outDir).startsWith(withTrailingSlash(root))) {
      // warn if outDir is outside of root
      logger?.warn(
        colors.yellow(
          `\n${colors.bold(`(!)`)} outDir ${colors.white(
            colors.dim(outDir)
          )} is not inside project root and will not be emptied.\n` +
            `Use --emptyOutDir to override.\n`
        )
      );
      return false;
    }
  }
  return true;
}

// 返回解析后的 chokidar 选项
export function resolveChokidarOptions(
  options: WatchOptions | undefined,
  resolvedOutDirs: Set<string>,
  emptyOutDir: boolean,
  cacheDir: string
): WatchOptions {
  const { ignored: ignoredList, ...otherOptions } = options ?? {};
  const ignored: WatchOptions["ignored"] = [
    "**/.git/**",
    "**/node_modules/**",
    "**/test-results/**", // Playwright
    glob.escapePath(cacheDir) + "/**",
    ...arraify(ignoredList || []),
  ];
  if (emptyOutDir) {
    ignored.push(
      ...[...resolvedOutDirs].map((outDir) => glob.escapePath(outDir) + "/**")
    );
  }

  const resolvedWatchOptions: WatchOptions = {
    ignored,
    ignoreInitial: true,
    ignorePermissionErrors: true,
    ...otherOptions,
  };

  return resolvedWatchOptions;
}

// 空观察器
class NoopWatcher extends EventEmitter implements FSWatcher {
  constructor(public options: WatchOptions) {
    super();
  }

  add() {
    return this;
  }

  unwatch() {
    return this;
  }

  getWatched() {
    return {};
  }

  ref() {
    return this;
  }

  unref() {
    return this;
  }

  async close() {
    // noop
  }
}

// 创建 空观察器
export function createNoopWatcher(options: WatchOptions): FSWatcher {
  return new NoopWatcher(options);
}
