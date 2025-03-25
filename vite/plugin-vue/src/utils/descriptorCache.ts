import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { CompilerError, SFCDescriptor } from "vue/compiler-sfc";
import { normalizePath } from "vite";
import type { ResolvedOptions, VueQuery } from "../index";

// compiler-sfc should be exported so it can be re-used
export interface SFCParseResult {
  descriptor: SFCDescriptor;
  errors: (CompilerError | SyntaxError)[];
}

export const cache = new Map<string, SFCDescriptor>();
// we use a separate descriptor cache for HMR purposes.
// The main cached descriptors are parsed from SFCs that may have been
// transformed by other plugins, e.g. vue-macros;
// The HMR cached descriptors are based on the raw, pre-transform SFCs.
export const hmrCache = new Map<string, SFCDescriptor>();
const prevCache = new Map<string, SFCDescriptor | undefined>();

// 分析 源代码 并返回 描述符对象
export function createDescriptor(
  filename: string,
  source: string,
  { root, isProduction, sourceMap, compiler, template }: ResolvedOptions,
  hmr = false
): SFCParseResult {
  const { descriptor, errors } = compiler.parse(source, {
    filename,
    sourceMap,
    templateParseOptions: template?.compilerOptions,
  });

  // ensure the path is normalized in a way that is consistent inside
  // project (relative to root) and on different systems.
  const normalizedPath = normalizePath(path.relative(root, filename));
  // 对 文件路径 进行 哈希
  descriptor.id = getHash(normalizedPath + (isProduction ? source : ""));
  // 缓存
  (hmr ? hmrCache : cache).set(filename, descriptor);
  return { descriptor, errors };
}

export function getPrevDescriptor(filename: string): SFCDescriptor | undefined {
  return prevCache.get(filename);
}

export function invalidateDescriptor(filename: string, hmr = false): void {
  const _cache = hmr ? hmrCache : cache;
  const prev = _cache.get(filename);
  _cache.delete(filename);
  if (prev) {
    prevCache.set(filename, prev);
  }
}

// 返回解析源代码后的 描述符对象
export function getDescriptor(
  filename: string,
  options: ResolvedOptions,
  createIfNotFound = true,
  hmr = false,
  code?: string
): SFCDescriptor | undefined {
  const _cache = hmr ? hmrCache : cache;
  if (_cache.has(filename)) {
    return _cache.get(filename)!;
  }
  if (createIfNotFound) {
    const { descriptor, errors } = createDescriptor(
      filename,
      code ?? fs.readFileSync(filename, "utf-8"),
      options,
      hmr
    );
    if (errors.length && !hmr) {
      throw errors[0];
    }
    return descriptor;
  }
}

//
export function getSrcDescriptor(
  filename: string,
  query: VueQuery
): SFCDescriptor {
  if (query.scoped) {
    return cache.get(`${filename}?src=${query.src}`)!;
  }
  return cache.get(filename)!;
}

//
export function getTempSrcDescriptor(
  filename: string,
  query: VueQuery
): SFCDescriptor {
  // this is only used for pre-compiled <style src> with scoped flag
  return {
    filename,
    id: query.id || "",
    styles: [
      {
        scoped: query.scoped,
        loc: {
          start: { line: 0, column: 0 },
        },
      },
    ],
  } as SFCDescriptor;
}

//
export function setSrcDescriptor(
  filename: string,
  entry: SFCDescriptor,
  scoped?: boolean
): void {
  if (scoped) {
    // if multiple Vue files use the same src file, they will be overwritten
    // should use other key
    cache.set(`${filename}?src=${entry.id}`, entry);
    return;
  }
  cache.set(filename, entry);
}

// 返回 哈希函数
const hash =
  crypto.hash ??
  ((
    algorithm: string,
    data: crypto.BinaryLike,
    outputEncoding: crypto.BinaryToTextEncoding
  ) => crypto.createHash(algorithm).update(data).digest(outputEncoding));

// 哈希
function getHash(text: string): string {
  return hash("sha256", text, "hex").substring(0, 8);
}
