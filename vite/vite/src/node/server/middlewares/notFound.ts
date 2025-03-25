import type { Connect } from "dep-types/connect";

// 404 中间件
// 作用：
// 如果请求的资源不存在，则返回 404 状态码
export function notFoundMiddleware(): Connect.NextHandleFunction {
  return function vite404Middleware(_, res) {
    res.statusCode = 404;
    res.end();
  };
}
