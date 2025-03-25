import type { Connect } from "dep-types/connect";
import { joinUrlSegments, stripBase } from "../../utils";
import { cleanUrl, withTrailingSlash } from "../../../shared/utils";

// 基础中间件
// 当 base 不等于 '/' 时，这个中间件才会生效
// 作用：
export function baseMiddleware(
  rawBase: string,
  middlewareMode: boolean
): Connect.NextHandleFunction {
  return function viteBaseMiddleware(req, res, next) {
    const url = req.url!;
    const pathname = cleanUrl(url);
    const base = rawBase;

    if (pathname.startsWith(base)) {
      // rewrite url to remove base. this ensures that other middleware does
      // not need to consider base being prepended or not
      req.url = stripBase(url, base);
      return next();
    }

    // skip redirect and error fallback on middleware mode, #4057
    if (middlewareMode) {
      return next();
    }

    // 重定向到 根目录
    if (pathname === "/" || pathname === "/index.html") {
      // redirect root visit to based url with search and hash
      res.writeHead(302, {
        Location: base + url.slice(pathname.length),
      });
      res.end();
      return;
    }

    // non-based page visit
    const redirectPath =
      withTrailingSlash(url) !== base ? joinUrlSegments(base, url) : base;
    if (req.headers.accept?.includes("text/html")) {
      res.writeHead(404, {
        "Content-Type": "text/html",
      });
      res.end(
        `The server is configured with a public base URL of ${base} - ` +
          `did you mean to visit <a href="${redirectPath}">${redirectPath}</a> instead?`
      );
      return;
    } else {
      // not found for resources
      res.writeHead(404, {
        "Content-Type": "text/plain",
      });
      res.end(
        `The server is configured with a public base URL of ${base} - ` +
          `did you mean to visit ${redirectPath} instead?`
      );
      return;
    }
  };
}
