import path from "node:path";
import type { Connect } from "dep-types/connect";
import { createDebugger } from "../../utils";
import type { FsUtils } from "../../fsUtils";
import { commonFsUtils } from "../../fsUtils";
import { cleanUrl } from "../../../shared/utils";

const debug = createDebugger("vite:html-fallback");

// 回退到 HTML 的中间件
// 作用：
// 如果请求的资源不存在，则回退到 index.html 或 .html 文件
export function htmlFallbackMiddleware(
  root: string,
  spaFallback: boolean,
  fsUtils: FsUtils = commonFsUtils
): Connect.NextHandleFunction {
  // Keep the named function. The name is visible in debug logs via `DEBUG=connect:dispatcher ...`
  return function viteHtmlFallbackMiddleware(req, _res, next) {
    if (
      // 只接受 GET 或 HEAD 请求
      (req.method !== "GET" && req.method !== "HEAD") ||
      // 排除 favicon 请求
      req.url === "/favicon.ico" ||
      // 要求 Accept: text/html 或 */*
      !(
        req.headers.accept === undefined ||
        req.headers.accept === "" ||
        req.headers.accept.includes("text/html") ||
        req.headers.accept.includes("*/*")
      )
    ) {
      return next();
    }

    const url = cleanUrl(req.url!);
    const pathname = decodeURIComponent(url);

    // .html 文件不会被 serveStaticMiddleware 处理
    // 如果路径以 .html 结尾，则检查文件是否存在
    if (pathname.endsWith(".html")) {
      const filePath = path.join(root, pathname);
      if (fsUtils.existsSync(filePath)) {
        debug?.(`Rewriting ${req.method} ${req.url} to ${url}`);
        req.url = url;
        return next();
      }
    }
    // 以 / 结尾的路径应以回退到 index.html 的方式返回
    else if (pathname[pathname.length - 1] === "/") {
      const filePath = path.join(root, pathname, "index.html");
      if (fsUtils.existsSync(filePath)) {
        const newUrl = url + "index.html";
        debug?.(`Rewriting ${req.method} ${req.url} to ${newUrl}`);
        req.url = newUrl;
        return next();
      }
    }
    // 非以 / 结尾的路径应以回退到 .html 的方式返回
    else {
      const filePath = path.join(root, pathname + ".html");
      if (fsUtils.existsSync(filePath)) {
        const newUrl = url + ".html";
        debug?.(`Rewriting ${req.method} ${req.url} to ${newUrl}`);
        req.url = newUrl;
        return next();
      }
    }

    if (spaFallback) {
      debug?.(`Rewriting ${req.method} ${req.url} to /index.html`);
      req.url = "/index.html";
    }

    next();
  };
}
