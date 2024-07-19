"use strict";

const { AsyncParallelHook, AsyncSeriesBailHook, SyncHook } = require("tapable");
const {
	makeWebpackError,
	makeWebpackErrorCallback
} = require("./HookWebpackError");

// 作用: 
// 1. 保证 某个函数 必须调用 N 次后 再执行回调函数
// 2. 如果 某个函数 在执行过程中出错 则直接执行回调函数
const needCalls = (times, callback) => {
	return err => {
		if (--times === 0) {
			return callback(err);
		}
		if (err && times > 0) {
			times = 0;
			return callback(err);
		}
	};
};

// 缓存
// 作用:
// 调用缓存钩子
class Cache {
	constructor() {
		this.hooks = {
			// 读取缓存
			get: new AsyncSeriesBailHook(["identifier", "etag", "gotHandlers"]),
			// 缓存
			store: new AsyncParallelHook(["identifier", "etag", "data"]),
			// AsyncParallelHook<[Iterable<string>]>
			// 缓存构建依赖
			storeBuildDependencies: new AsyncParallelHook(["dependencies"]),
			//
			beginIdle: new SyncHook([]),
			//
			endIdle: new AsyncParallelHook([]),
			// 关闭时 清楚缓存
			shutdown: new AsyncParallelHook([])
		};
	}

	// 读取缓存
	get(identifier, etag, callback) {
		// 获取缓存函数队列
		const gotHandlers = [];
		this.hooks.get.callAsync(identifier, etag, gotHandlers, (err, result) => {
			if (err) {
				callback(makeWebpackError(err, "Cache.hooks.get"));
				return;
			}
			if (result === null) {
				result = undefined;
			}
			// 按序依次调用 获取缓存函数队列 并最终调用回调函数
			if (gotHandlers.length > 1) {
				const innerCallback = needCalls(gotHandlers.length, () =>
					callback(null, result)
				);
				for (const gotHandler of gotHandlers) {
					gotHandler(result, innerCallback);
				}
			} else if (gotHandlers.length === 1) {
				gotHandlers[0](result, () => callback(null, result));
			} else {
				callback(null, result);
			}
		});
	}

	// 存储
	store(identifier, etag, data, callback) {
		this.hooks.store.callAsync(
			identifier,
			etag,
			data,
			makeWebpackErrorCallback(callback, "Cache.hooks.store")
		);
	}

	// 缓存 构建依赖
	storeBuildDependencies(dependencies, callback) {
		this.hooks.storeBuildDependencies.callAsync(
			dependencies,
			makeWebpackErrorCallback(callback, "Cache.hooks.storeBuildDependencies")
		);
	}

	// 开始空闲
	beginIdle() {
		this.hooks.beginIdle.call();
	}

	// 结束 闲置
	endIdle(callback) {
		this.hooks.endIdle.callAsync(
			makeWebpackErrorCallback(callback, "Cache.hooks.endIdle")
		);
	}

	// 关闭时 清除缓存
	shutdown(callback) {
		this.hooks.shutdown.callAsync(
			makeWebpackErrorCallback(callback, "Cache.hooks.shutdown")
		);
	}
}

// 优先级
// 内存缓存优先级
Cache.STAGE_MEMORY = -10;
// 默认缓存优先级
Cache.STAGE_DEFAULT = 0;
// 磁盘缓存优先级
Cache.STAGE_DISK = 10;
// 网络缓存优先级
Cache.STAGE_NETWORK = 20;

module.exports = Cache;
