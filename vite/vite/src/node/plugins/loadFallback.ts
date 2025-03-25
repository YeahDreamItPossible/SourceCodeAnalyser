import fsp from "node:fs/promises";
import { cleanUrl } from "../../shared/utils";
import type { Plugin } from "../plugin";

// 资源加载回退插件
// 作用:
// 在加载资源时 优先使用对 包含参数的请求路径 过滤后的路径加载
// 如果报错时 则回退到使用最初的路径 即: 包含参数的请求路径
export function buildLoadFallbackPlugin(): Plugin {
  return {
    name: "vite:load-fallback",
    async load(id) {
      try {
        const cleanedId = cleanUrl(id);
        const content = await fsp.readFile(cleanedId, "utf-8");
        this.addWatchFile(cleanedId);
        return content;
      } catch {
        const content = await fsp.readFile(id, "utf-8");
        this.addWatchFile(id);
        return content;
      }
    },
  };
}
