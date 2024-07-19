"use strict";

const Cache = require("../Cache");

// 带有垃圾回收的内存缓存策略
// 作用:
// 在编译过程中 缓存生成的 Module 和 Chunk
// 使用: 
// 当 Webpack.options.cache.type = memory 且 Webpack.options.cache.maxGenerations ===  Infinity 时
// 或者当 Webpack.options.cache.type = filesystem 且 Webpack.options.cache.maxGenerations !== 0 时
// 与 MemoryCachePlugin 区别:
// 根据用户配置 通过代际管理和LRU(最近最少使用)策略来优化缓存的使用和清理(手动管理未被使用项的存在的生命周期)
class MemoryWithGcCachePlugin {
	constructor({ maxGenerations }) {
		// 定义内存缓存中未使用的缓存项的生命周期
		// cache.maxGenerations: 1  表示在一次编译中未使用的缓存被删除
		// cache.maxGenerations: Infinity 表示缓存将永远保存
		this._maxGenerations = maxGenerations;
	}
	
	apply(compiler) {
		// 定义内存缓存中未使用的缓存项的生命周期
		// 即: 当完成一次编译后 要清除 N 个未使用的缓存项要被清除 ??
		const maxGenerations = this._maxGenerations;
		// 存储的缓存项
		// Map<string, { etag: Etag | null, data: any }>
		const cache = new Map();
		// 存储最近被清理出 cache 但尚未达到其生命周期结束的缓存项
		// 这些项在后续的构建中可能会被重新激活
		// Map<string, { entry: { etag: Etag | null, data: any }, until: number }>
		const oldCache = new Map();
		// 计数器 每次编译完成后递增
		let generation = 0;
		// 索引
		// 用于在cache中定位要清理的项，通过结合maxGenerations和cache.size来计算
		let cachePosition = 0;
		const logger = compiler.getInfrastructureLogger("MemoryWithGcCachePlugin");

		/**
		 * 管理缓存算法核心:
		 * 通过结合代际管理和LRU策略来优化缓存的使用
		 * 代际管理通过跟踪每个缓存项的生命周期来确保旧数据不会永远留在缓存中
		 * LRU策略通过定期清理最少使用的缓存项来保持缓存的新鲜度和有效性
		 * 通过将清理的项移至oldCache而不是立即删除
		 * 代码还减少了Map的重新哈希次数
		 * 从而提高了性能。
		 */
		compiler.hooks.afterDone.tap("MemoryWithGcCachePlugin", () => {
			// 在每次构建完成后 计数器递增
			generation++;
			// 清理的项数
			let clearedEntries = 0;
			// 
			let lastClearedIdentifier;
			// 遍历oldCache，删除所有entry.until <= generation的项(即已过期的项）
			for (const [identifier, entry] of oldCache) {
				if (entry.until > generation) break;

				oldCache.delete(identifier);
				// 如果 oldCache 中的项在 cache 中已不存在(即已被外部逻辑删除)
				// 则从 cache 中也删除相应的项，并记录清理的项数
				if (cache.get(identifier) === undefined) {
					cache.delete(identifier);
					clearedEntries++;
					lastClearedIdentifier = identifier;
				}
			}
			if (clearedEntries > 0 || oldCache.size > 0) {
				logger.log(
					`${cache.size - oldCache.size} active entries, ${
						oldCache.size
					} recently unused cached entries${
						clearedEntries > 0
							? `, ${clearedEntries} old unused cache entries removed e. g. ${lastClearedIdentifier}`
							: ""
					}`
				);
			}
			// 计算需要清理的缓存项数(向下取整)
			// 当任何数字与0进行按位或(|)操作时 结果总是原始的数字本身
			let i = (cache.size / maxGenerations) | 0;
			let j = cachePosition >= cache.size ? 0 : cachePosition;
			// 用于在cache中定位起始清理点 通过循环确保每次清理是均匀的
			cachePosition = j + i;
			for (const [identifier, entry] of cache) {
				if (j !== 0) {
					j--;
					continue;
				}
				// 遍历cache
				// 从cachePosition开始
				// 将遇到的每个项从cache中“删除”(实际上是设为undefined)
				// 并将其移至oldCache中，
				// 设置其until为当前generation + maxGenerations 以表示其生命周期
				if (entry !== undefined) {
					// 注意:
					// 这里的“删除”并不是真的从Map中删除
					// 而是将值设为undefined
					// 这样做的好处是避免了Map的重新哈希
					// 因为Map的大小没有改变
					// 当这些项再次从oldCache中删除时 它们才会真正从Map中移除
					cache.set(identifier, undefined);
					oldCache.delete(identifier);
					oldCache.set(identifier, {
						entry,
						until: generation + maxGenerations
					});
					if (i-- === 0) break;
				}
			}
		});

		// 存储
		compiler.cache.hooks.store.tap(
			{ name: "MemoryWithGcCachePlugin", stage: Cache.STAGE_MEMORY },
			(identifier, etag, data) => {
				cache.set(identifier, { etag, data });
			}
		);

		// 读取缓存
		compiler.cache.hooks.get.tap(
			{ name: "MemoryWithGcCachePlugin", stage: Cache.STAGE_MEMORY },
			(identifier, etag, gotHandlers) => {
				// 读取缓存
				const cacheEntry = cache.get(identifier);
				// 缓存不存在
				if (cacheEntry === null) {
					return null;
				} else if (cacheEntry !== undefined) {
					// 缓存存在时 判断缓存的电子标签是否一致
					return cacheEntry.etag === etag ? cacheEntry.data : null;
				}
				const oldCacheEntry = oldCache.get(identifier);
				if (oldCacheEntry !== undefined) {
					const cacheEntry = oldCacheEntry.entry;
					if (cacheEntry === null) {
						oldCache.delete(identifier);
						cache.set(identifier, cacheEntry);
						return null;
					} else {
						if (cacheEntry.etag !== etag) return null;
						oldCache.delete(identifier);
						cache.set(identifier, cacheEntry);
						return cacheEntry.data;
					}
				}

				// 向获取缓存函数队列中 添加函数
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
			{ name: "MemoryWithGcCachePlugin", stage: Cache.STAGE_MEMORY },
			() => {
				cache.clear();
				oldCache.clear();
			}
		);
	}
}
module.exports = MemoryWithGcCachePlugin;
