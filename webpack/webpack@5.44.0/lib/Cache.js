"use strict";

const { AsyncParallelHook, AsyncSeriesBailHook, SyncHook } = require("tapable");
const {
	makeWebpackError,
	makeWebpackErrorCallback
} = require("./HookWebpackError");

/** @typedef {import("./WebpackError")} WebpackError */

/**
 * @typedef {Object} Etag
 * @property {function(): string} toString
 */

/**
 * @template T
 * @callback CallbackCache
 * @param {WebpackError=} err
 * @param {T=} result
 * @returns {void}
 */

/**
 * @callback GotHandler
 * @param {any} result
 * @param {function(Error=): void} callback
 * @returns {void}
 */

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
class Cache {
	constructor() {
		this.hooks = {
			/** @type {AsyncSeriesBailHook<[string, Etag | null, GotHandler[]], any>} */
			get: new AsyncSeriesBailHook(["identifier", "etag", "gotHandlers"]),
			/** @type {AsyncParallelHook<[string, Etag | null, any]>} */
			store: new AsyncParallelHook(["identifier", "etag", "data"]),
			/** @type {AsyncParallelHook<[Iterable<string>]>} */
			storeBuildDependencies: new AsyncParallelHook(["dependencies"]),
			/** @type {SyncHook<[]>} */
			beginIdle: new SyncHook([]),
			/** @type {AsyncParallelHook<[]>} */
			endIdle: new AsyncParallelHook([]),
			/** @type {AsyncParallelHook<[]>} */
			shutdown: new AsyncParallelHook([])
		};
	}

	// 读取缓存
	get(identifier, etag, callback) {
		const gotHandlers = [];
		this.hooks.get.callAsync(identifier, etag, gotHandlers, (err, result) => {
			if (err) {
				callback(makeWebpackError(err, "Cache.hooks.get"));
				return;
			}
			if (result === null) {
				result = undefined;
			}
			// 重新存储
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

	/**
	 * After this method has succeeded the cache can only be restored when build dependencies are
	 * @param {Iterable<string>} dependencies list of all build dependencies
	 * @param {CallbackCache<void>} callback signals when the dependencies are stored
	 * @returns {void}
	 */
	storeBuildDependencies(dependencies, callback) {
		this.hooks.storeBuildDependencies.callAsync(
			dependencies,
			makeWebpackErrorCallback(callback, "Cache.hooks.storeBuildDependencies")
		);
	}

	
	beginIdle() {
		this.hooks.beginIdle.call();
	}

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

Cache.STAGE_MEMORY = -10;
Cache.STAGE_DEFAULT = 0;
Cache.STAGE_DISK = 10;
Cache.STAGE_NETWORK = 20;

module.exports = Cache;
