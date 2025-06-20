import gensync, { type Handler } from "gensync";

import loadConfig from "./config/index.ts";
import type { InputOptions, ResolvedConfig } from "./config/index.ts";
import { run } from "./transformation/index.ts";

import type { FileResult, FileResultCallback } from "./transformation/index.ts";
import { beginHiddenCallStack } from "./errors/rewrite-stack-trace.ts";

export type { FileResult } from "./transformation/index.ts";

type Transform = {
  (code: string, callback: FileResultCallback): void;
  (
    code: string,
    opts: InputOptions | undefined | null,
    callback: FileResultCallback,
  ): void;
  (code: string, opts?: InputOptions | null): FileResult | null;
};

const transformRunner = gensync(function* transform(
  code: string,
  opts?: InputOptions,
): Handler<FileResult | null> {
  const config: ResolvedConfig | null = yield* loadConfig(opts);
  if (config === null) return null;

  return yield* run(config, code);
});

// 转换
export const transform: Transform = function transform(
  code,
  optsOrCallback?: InputOptions | null | undefined | FileResultCallback,
  maybeCallback?: FileResultCallback,
) {
  let opts: InputOptions | undefined | null;
  let callback: FileResultCallback | undefined;
  if (typeof optsOrCallback === "function") {
    callback = optsOrCallback;
    opts = undefined;
  } else {
    opts = optsOrCallback;
    callback = maybeCallback;
  }

  if (callback === undefined) {
    if (process.env.BABEL_8_BREAKING) {
      throw new Error(
        "Starting from Babel 8.0.0, the 'transform' function expects a callback. If you need to call it synchronously, please use 'transformSync'.",
      );
    } else {
      // console.warn(
      //   "Starting from Babel 8.0.0, the 'transform' function will expect a callback. If you need to call it synchronously, please use 'transformSync'.",
      // );
      return beginHiddenCallStack(transformRunner.sync)(code, opts);
    }
  }

  beginHiddenCallStack(transformRunner.errback)(code, opts, callback);
};

// 同步转换
export function transformSync(
  ...args: Parameters<typeof transformRunner.sync>
) {
  return beginHiddenCallStack(transformRunner.sync)(...args);
}

// 异步转换
export function transformAsync(
  ...args: Parameters<typeof transformRunner.async>
) {
  return beginHiddenCallStack(transformRunner.async)(...args);
}
