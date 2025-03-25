declare module "vue/compiler-sfc" {
  interface SFCDescriptor {
    id: string;
  }
}

import { createRequire } from "node:module";
import type * as _compiler from "vue/compiler-sfc";

// 返回加载后的 compiler 函数
export function resolveCompiler(root: string): typeof _compiler {
  // resolve from project root first, then fallback to peer dep (if any)
  const compiler = tryResolveCompiler(root) || tryResolveCompiler();
  if (!compiler) {
    throw new Error(
      `Failed to resolve vue/compiler-sfc.\n` +
        `@vitejs/plugin-vue requires vue (>=3.2.25) ` +
        `to be present in the dependency tree.`
    );
  }

  return compiler;
}

// 加载 @vue/compile-sfc 插件
function tryResolveCompiler(root?: string) {
  const vueMeta = tryRequire("vue/package.json", root);
  // 只有 vue@3 才有 @vue/compile-sfc 插件
  if (vueMeta && vueMeta.version.split(".")[0] >= 3) {
    return tryRequire("vue/compiler-sfc", root);
  }
}

// 创建 require 函数
// import.meta.url:
// 引用 当前文件 的完整URL
const _require = createRequire(import.meta.url);
function tryRequire(id: string, from?: string) {
  try {
    return from
      ? _require(_require.resolve(id, { paths: [from] }))
      : _require(id);
  } catch (e) {}
}
