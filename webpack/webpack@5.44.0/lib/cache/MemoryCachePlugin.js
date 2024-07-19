"use strict";

const Cache = require("../Cache");

// 内存缓存策略
// 作用: 
// 在编译过程中 缓存生成的 Module 和 Chunk
// 使用: 
// 当 Webpack.options.cache.type = memory 且 Webpack.options.cache.maxGenerations !==  Infinity 时
// 或者当 Webpack.options.cache.type = filesystem 且 Webpack.options.cache.maxGenerations !==  Infinity 时
class MemoryCachePlugin {
	apply(compiler) {
		// 缓存对象
		const cache = new Map();

		// 存储
		compiler.cache.hooks.store.tap(
			{ name: "MemoryCachePlugin", stage: Cache.STAGE_MEMORY },
			(identifier, etag, data) => {
				cache.set(identifier, { etag, data });
			}
		);

		// 读取缓存
		compiler.cache.hooks.get.tap(
			{ name: "MemoryCachePlugin", stage: Cache.STAGE_MEMORY },
			(identifier, etag, gotHandlers) => {
				// 从内存中读取缓存
				const cacheEntry = cache.get(identifier);
				// 当缓存不存在时(之前缓存过 后来被清除)
				if (cacheEntry === null) {
					return null;
				} 
				// 当缓存存在时
				else if (cacheEntry !== undefined) {
					// 当缓存存在时 判断缓存中电子标签 与 当前电子标签 是否一致
					return cacheEntry.etag === etag ? cacheEntry.data : null;
				}
				// 第一次存储
				gotHandlers.push((result, callback) => {
					if (result === undefined) {
						// 当结果不存在时 表示要清除当前缓存
						cache.set(identifier, null);
					} else {
						// 存储
						cache.set(identifier, { etag, data: result });
					}
					return callback();
				});
			}
		);

		// 清除缓存
		compiler.cache.hooks.shutdown.tap(
			{ name: "MemoryCachePlugin", stage: Cache.STAGE_MEMORY },
			() => {
				cache.clear();
			}
		);
	}
}
module.exports = MemoryCachePlugin;
