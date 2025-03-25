import { URL } from "node:url";
import type { Plugin } from "../plugin";

const dataUriRE = /^([^/]+\/[^;,]+)(;base64)?,([\s\S]*)$/;
const base64RE = /base64/i;
const dataUriPrefix = `\0/@data-uri/`;

/**
 * 数据URL(Data URL):
 * 前缀为 data: 协议的 URL，其允许内容创建者向文档中嵌入小文件
 * 'data:text/javascript;base64,YWxlcnQoJ+WcqHNjcmlwdOS4reS9v+eUqERhdGEgVVJMJykK'
 * =>
 * 'alert('在script中使用Data URL')'
 */

// 数据URL插件
// 作用:
// 当 请求路径 是脚本类型的Data URL时 在加载资源时直接返回 Data URL 的内容
export function dataURIPlugin(): Plugin {
  let resolved: Map<string, string>;

  return {
    name: "vite:data-uri",

    buildStart() {
      resolved = new Map();
    },

    resolveId(id) {
      // 请求路径必须以 data url 开头
      if (!id.trimStart().startsWith("data:")) {
        return;
      }

      // 请求路径必须以 data url 开头
      const uri = new URL(id);
      if (uri.protocol !== "data:") {
        return;
      }

      //
      const match = dataUriRE.exec(uri.pathname);
      if (!match) {
        return;
      }

      const [, mime, format, data] = match;
      // 必须是 脚本类型 的 Data URL
      if (mime !== "text/javascript") {
        throw new Error(
          `data URI with non-JavaScript mime type is not supported. If you're using legacy JavaScript MIME types (such as 'application/javascript'), please use 'text/javascript' instead.`
        );
      }

      // base64 解码
      const base64 = format && base64RE.test(format.substring(1));
      // Data URL 中的 内容
      const content = base64
        ? Buffer.from(data, "base64").toString("utf-8")
        : data;
      resolved.set(id, content);
      return dataUriPrefix + id;
    },

    load(id) {
      if (id.startsWith(dataUriPrefix)) {
        return resolved.get(id.slice(dataUriPrefix.length));
      }
    },
  };
}
