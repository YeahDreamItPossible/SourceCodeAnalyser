"use strict";

const Cache = require("../Cache");

// 根据 Webpack.options.cache.type = memory 使用该插件
// 内存缓存策略
class MemoryCachePlugin {
	apply(compiler) {
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
				const cacheEntry = cache.get(identifier);
				if (cacheEntry === null) {
					return null;
				} else if (cacheEntry !== undefined) {
					// 验证
					return cacheEntry.etag === etag ? cacheEntry.data : null;
				}
				// 重新存储
				gotHandlers.push((result, callback) => {
					if (result === undefined) {
						cache.set(identifier, null);
					} else {
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
