import { performance } from "node:perf_hooks";
import type { Connect } from "dep-types/connect";
import { createDebugger, prettifyUrl, timeFrom } from "../../utils";

const logTime = createDebugger("vite:time");

// 时间中间件
// 作用：
// 记录每个请求的访问时间
export function timeMiddleware(root: string): Connect.NextHandleFunction {
  return function viteTimeMiddleware(req, res, next) {
    const start = performance.now();
    const end = res.end;
    res.end = (...args: readonly [any, any?, any?]) => {
      logTime?.(`${timeFrom(start)} ${prettifyUrl(req.url!, root)}`);
      return end.call(res, ...args);
    };
    next();
  };
}
