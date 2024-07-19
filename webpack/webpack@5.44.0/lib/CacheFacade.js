"use strict";

const asyncLib = require("neo-async");
const getLazyHashedEtag = require("./cache/getLazyHashedEtag");
const mergeEtags = require("./cache/mergeEtags");

// 多项缓存
// 作用:
// 1. 存储 ItemCacheFacade
class MultiItemCache {
	constructor(items) {
		// Array<ItemCacheFacade>
		this._items = items;
		if (items.length === 1) return /** @type {any} */ (items[0]);
	}

	// 读取缓存
	get(callback) {
		const next = i => {
			this._items[i].get((err, result) => {
				if (err) return callback(err);
				if (result !== undefined) return callback(null, result);
				if (++i >= this._items.length) return callback();
				next(i);
			});
		};
		next(0);
	}

	// 以 Promise 的方式读取缓存
	getPromise() {
		const next = i => {
			return this._items[i].getPromise().then(result => {
				if (result !== undefined) return result;
				if (++i < this._items.length) return next(i);
			});
		};
		return next(0);
	}

	// 存储缓存
	store(data, callback) {
		asyncLib.each(
			this._items,
			(item, callback) => item.store(data, callback),
			callback
		);
	}

	// 以 Promise 的方式存储缓存
	storePromise(data) {
		return Promise.all(this._items.map(item => item.storePromise(data))).then(
			() => {}
		);
	}
}

// 单项缓存
// 作用:
// 1.
class ItemCacheFacade {
	constructor(cache, name, etag) {
		// Cache 实例
		this._cache = cache;
		// 缓存名称(实际上是 缓存标识)
		this._name = name;
		// 缓存电子标签
		this._etag = etag;
	}

	// 读取缓存
	get(callback) {
		this._cache.get(this._name, this._etag, callback);
	}

	// 以返回Promise的方式读取缓存
	getPromise() {
		return new Promise((resolve, reject) => {
			this._cache.get(this._name, this._etag, (err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			});
		});
	}

	// 存储
	store(data, callback) {
		this._cache.store(this._name, this._etag, data, callback);
	}

	// 以返回Promise的方式缓存
	storePromise(data) {
		return new Promise((resolve, reject) => {
			this._cache.store(this._name, this._etag, data, err => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	// 读取缓存 
	// 如果当前缓存未被存储 当通过计算函数计算后 存储当前缓存
	provide(computer, callback) {
		this.get((err, cacheEntry) => {
			if (err) return callback(err);
			if (cacheEntry !== undefined) return cacheEntry;
			computer((err, result) => {
				if (err) return callback(err);
				this.store(result, err => {
					if (err) return callback(err);
					callback(null, result);
				});
			});
		});
	}

	// 以返回Promise的方式读取缓存
	// 如果当前缓存未被存储 当通过计算函数计算后 存储当前缓存
	async providePromise(computer) {
		const cacheEntry = await this.getPromise();
		if (cacheEntry !== undefined) return cacheEntry;
		const result = await computer();
		await this.storePromise(result);
		return result;
	}
}

// 缓存(外观模式)
// 作用: 主要是对 Cache 类功能扩展
// 1. 增加缓存标识(name)
// 2. 允许同时存储多项缓存
class CacheFacade {
	constructor(cache, name) {
		// 缓存
		this._cache = cache;
		// 缓存名称
		this._name = name;
	}

	// 克隆当前CacheFacade
	getChildCache(name) {
		return new CacheFacade(this._cache, `${this._name}|${name}`);
	}

	// 返回 ItemCachFacade 的实例
	getItemCache(identifier, etag) {
		return new ItemCacheFacade(
			this._cache,
			`${this._name}|${identifier}`,
			etag
		);
	}

	// 返回Etag
	getLazyHashedEtag(obj) {
		return getLazyHashedEtag(obj);
	}

	// 合并Etag
	mergeEtags(a, b) {
		return mergeEtags(a, b);
	}

	// 读取缓存
	get(identifier, etag, callback) {
		this._cache.get(`${this._name}|${identifier}`, etag, callback);
	}

	// 以返回Promise的方式读取缓存
	getPromise(identifier, etag) {
		return new Promise((resolve, reject) => {
			this._cache.get(`${this._name}|${identifier}`, etag, (err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			});
		});
	}

	// 存储
	store(identifier, etag, data, callback) {
		this._cache.store(`${this._name}|${identifier}`, etag, data, callback);
	}

	// 以返回Promise的方式缓存
	storePromise(identifier, etag, data) {
		return new Promise((resolve, reject) => {
			this._cache.store(`${this._name}|${identifier}`, etag, data, err => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
	
	// 读取缓存 
	// 如果当前缓存未被存储 当通过计算函数计算后 存储当前缓存
	provide(identifier, etag, computer, callback) {
		// 读取缓存
		this.get(identifier, etag, (err, cacheEntry) => {
			if (err) return callback(err);
			if (cacheEntry !== undefined) return cacheEntry;
			// 如果当前缓存未被存储 通过计算函数计算后 存储当前缓存
			// 计算函数: 计算当前未被缓存的值
			computer((err, result) => {
				if (err) return callback(err);
				this.store(identifier, etag, result, err => {
					if (err) return callback(err);
					callback(null, result);
				});
			});
		});
	}

	// 以返回Promise的方式读取缓存
	// 如果当前缓存未被存储 当通过计算函数计算后 存储当前缓存
	async providePromise(identifier, etag, computer) {
		const cacheEntry = await this.getPromise(identifier, etag);
		if (cacheEntry !== undefined) return cacheEntry;
		const result = await computer();
		await this.storePromise(identifier, etag, result);
		return result;
	}
}

module.exports = CacheFacade;
module.exports.ItemCacheFacade = ItemCacheFacade;
module.exports.MultiItemCache = MultiItemCache;
