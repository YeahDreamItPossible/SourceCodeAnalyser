"use strict";

const Cache = require("../Cache");
const ProgressPlugin = require("../ProgressPlugin");

// 缓存构建依赖的 Key 标识
const BUILD_DEPENDENCIES_KEY = Symbol();

// 在空闲时间段文件缓存插件
// 作用:
// 当编译器闲置时候，将缓存数据以异步的方式存储到缓存文件中
class IdleFileCachePlugin {
	constructor(
		strategy,
		idleTimeout,
		idleTimeoutForInitialStore,
		idleTimeoutAfterLargeChanges
	) {
		this.strategy = strategy;
		// 缓存存储发生的时间间隔 以 ms 为单位
		// Webpack.options.cache.idleTimeout
		this.idleTimeout = idleTimeout;
		// 初始缓存存储发生后的时间段 以 ms 为单位
		// Webpack.options.cache.idleTimeoutForInitialStore
		this.idleTimeoutForInitialStore = idleTimeoutForInitialStore;
		// 是当检测到较大的更改时 缓存存储应在此之后发生的时间段 以 ms 为单位
		// Webpack.options.cache.idleTimeoutAfterLargeChanges
		this.idleTimeoutAfterLargeChanges = idleTimeoutAfterLargeChanges;
	}

	apply(compiler) {
		let strategy = this.strategy;
		// 缓存存储发生的时间间隔
		const idleTimeout = this.idleTimeout;
		// 初始缓存存储发生后的时间段
		const idleTimeoutForInitialStore = Math.min(
			idleTimeout,
			this.idleTimeoutForInitialStore
		);
		// 是当检测到较大的更改时 缓存存储应在此之后发生的时间段
		const idleTimeoutAfterLargeChanges = this.idleTimeoutAfterLargeChanges;
		const resolvedPromise = Promise.resolve();

		// 
		let timeSpendInBuild = 0;
		// 
		let timeSpendInStore = 0;
		// 
		let avgTimeSpendInStore = 0;

		/** @type {Map<string | typeof BUILD_DEPENDENCIES_KEY, () => Promise>} */
		// Map<String, Fn>
		const pendingIdleTasks = new Map();

		// 存储
		compiler.cache.hooks.store.tap(
			{ name: "IdleFileCachePlugin", stage: Cache.STAGE_DISK },
			(identifier, etag, data) => {
				pendingIdleTasks.set(identifier, () =>
					strategy.store(identifier, etag, data)
				);
			}
		);

		// 读取
		compiler.cache.hooks.get.tapPromise(
			{ name: "IdleFileCachePlugin", stage: Cache.STAGE_DISK },
			(identifier, etag, gotHandlers) => {
				const restore = () =>
					strategy.restore(identifier, etag).then(cacheEntry => {
						if (cacheEntry === undefined) {
							gotHandlers.push((result, callback) => {
								if (result !== undefined) {
									pendingIdleTasks.set(identifier, () =>
										strategy.store(identifier, etag, result)
									);
								}
								callback();
							});
						} else {
							return cacheEntry;
						}
					});
				const pendingTask = pendingIdleTasks.get(identifier);
				if (pendingTask !== undefined) {
					pendingIdleTasks.delete(identifier);
					return pendingTask().then(restore);
				}
				return restore();
			}
		);

		compiler.cache.hooks.storeBuildDependencies.tap(
			{ name: "IdleFileCachePlugin", stage: Cache.STAGE_DISK },
			dependencies => {
				pendingIdleTasks.set(BUILD_DEPENDENCIES_KEY, () =>
					strategy.storeBuildDependencies(dependencies)
				);
			}
		);

		compiler.cache.hooks.shutdown.tapPromise(
			{ name: "IdleFileCachePlugin", stage: Cache.STAGE_DISK },
			() => {
				if (idleTimer) {
					clearTimeout(idleTimer);
					idleTimer = undefined;
				}
				isIdle = false;
				const reportProgress = ProgressPlugin.getReporter(compiler);
				const jobs = Array.from(pendingIdleTasks.values());
				if (reportProgress) reportProgress(0, "process pending cache items");
				const promises = jobs.map(fn => fn());
				pendingIdleTasks.clear();
				promises.push(currentIdlePromise);
				const promise = Promise.all(promises);
				currentIdlePromise = promise.then(() => strategy.afterAllStored());
				if (reportProgress) {
					currentIdlePromise = currentIdlePromise.then(() => {
						reportProgress(1, `stored`);
					});
				}
				return currentIdlePromise.then(() => {
					// Reset strategy
					if (strategy.clear) strategy.clear();
				});
			}
		);

		/** @type {Promise<any>} */
		let currentIdlePromise = resolvedPromise;
		let isIdle = false;
		let isInitialStore = true;
		const processIdleTasks = () => {
			if (isIdle) {
				const startTime = Date.now();
				if (pendingIdleTasks.size > 0) {
					const promises = [currentIdlePromise];
					const maxTime = startTime + 100;
					let maxCount = 100;
					for (const [filename, factory] of pendingIdleTasks) {
						pendingIdleTasks.delete(filename);
						promises.push(factory());
						if (maxCount-- <= 0 || Date.now() > maxTime) break;
					}
					currentIdlePromise = Promise.all(promises);
					currentIdlePromise.then(() => {
						timeSpendInStore += Date.now() - startTime;
						// Allow to exit the process between
						idleTimer = setTimeout(processIdleTasks, 0);
						idleTimer.unref();
					});
					return;
				}
				currentIdlePromise = currentIdlePromise
					.then(async () => {
						await strategy.afterAllStored();
						timeSpendInStore += Date.now() - startTime;
						avgTimeSpendInStore =
							Math.max(avgTimeSpendInStore, timeSpendInStore) * 0.9 +
							timeSpendInStore * 0.1;
						timeSpendInStore = 0;
						timeSpendInBuild = 0;
					})
					.catch(err => {
						const logger = compiler.getInfrastructureLogger(
							"IdleFileCachePlugin"
						);
						logger.warn(`Background tasks during idle failed: ${err.message}`);
						logger.debug(err.stack);
					});
				isInitialStore = false;
			}
		};
		let idleTimer = undefined;
		compiler.cache.hooks.beginIdle.tap(
			{ name: "IdleFileCachePlugin", stage: Cache.STAGE_DISK },
			() => {
				const isLargeChange = timeSpendInBuild > avgTimeSpendInStore * 2;
				if (isInitialStore && idleTimeoutForInitialStore < idleTimeout) {
					compiler
						.getInfrastructureLogger("IdleFileCachePlugin")
						.log(
							`Initial cache was generated and cache will be persisted in ${
								idleTimeoutForInitialStore / 1000
							}s.`
						);
				} else if (
					isLargeChange &&
					idleTimeoutAfterLargeChanges < idleTimeout
				) {
					compiler
						.getInfrastructureLogger("IdleFileCachePlugin")
						.log(
							`Spend ${Math.round(timeSpendInBuild) / 1000}s in build and ${
								Math.round(avgTimeSpendInStore) / 1000
							}s in average in cache store. This is considered as large change and cache will be persisted in ${
								idleTimeoutAfterLargeChanges / 1000
							}s.`
						);
				}
				idleTimer = setTimeout(() => {
					idleTimer = undefined;
					isIdle = true;
					resolvedPromise.then(processIdleTasks);
				}, Math.min(isInitialStore ? idleTimeoutForInitialStore : Infinity, isLargeChange ? idleTimeoutAfterLargeChanges : Infinity, idleTimeout));
				idleTimer.unref();
			}
		);
		compiler.cache.hooks.endIdle.tap(
			{ name: "IdleFileCachePlugin", stage: Cache.STAGE_DISK },
			() => {
				if (idleTimer) {
					clearTimeout(idleTimer);
					idleTimer = undefined;
				}
				isIdle = false;
			}
		);
		compiler.hooks.done.tap("IdleFileCachePlugin", stats => {
			// 10% build overhead is ignored, as it's not cacheable
			timeSpendInBuild *= 0.9;
			timeSpendInBuild += stats.endTime - stats.startTime;
		});
	}
}

module.exports = IdleFileCachePlugin;
