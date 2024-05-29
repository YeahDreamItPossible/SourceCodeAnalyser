"use strict";

const NONE = Symbol("not sorted");

// 提供排序功能的 Set 子集
class SortableSet extends Set {
	/**
	 * Create a new sortable set
	 * @param {Iterable<T>=} initialIterable The initial iterable value
	 * @typedef {function(T, T): number} SortFunction
	 * @param {SortFunction=} defaultSort Default sorting function
	 */
	constructor(initialIterable, defaultSort) {
		super(initialIterable);
		// 当前排序函数
		this._sortFn = defaultSort;
		// 缓存上一个排序函数
		/** @private @type {typeof NONE | undefined | function(T, T): number}} */
		this._lastActiveSortFn = NONE;
		// Map<Function, Function(this)> | undefined>
		this._cache = undefined;
		// Map<Function, Function(this)> | undefined>
		this._cacheOrderIndependent = undefined;
	}

	// 添加元素
	add(value) {
		this._lastActiveSortFn = NONE;
		this._invalidateCache();
		this._invalidateOrderedCache();
		super.add(value);
		return this;
	}

	// 删除 单个元素
	delete(value) {
		this._invalidateCache();
		this._invalidateOrderedCache();
		return super.delete(value);
	}

	// 清空 所有的元素
	clear() {
		this._invalidateCache();
		this._invalidateOrderedCache();
		return super.clear();
	}

	// 通过 给定的排序函数 对元素排序
	sortWith(sortFn) {
		if (this.size <= 1 || sortFn === this._lastActiveSortFn) {
			// already sorted - nothing to do
			return;
		}

		const sortedArray = Array.from(this).sort(sortFn);
		super.clear();
		for (let i = 0; i < sortedArray.length; i += 1) {
			super.add(sortedArray[i]);
		}
		this._lastActiveSortFn = sortFn;
		this._invalidateCache();
	}

	// 对 元素 排序
	sort() {
		this.sortWith(this._sortFn);
		return this;
	}

	// 从 缓存 Map<fn, fn(this)> 中返回 fn(this)
	getFromCache(fn) {
		if (this._cache === undefined) {
			this._cache = new Map();
		} else {
			const result = this._cache.get(fn);
			const data = /** @type {R} */ (result);
			if (data !== undefined) {
				return data;
			}
		}
		const newData = fn(this);
		this._cache.set(fn, newData);
		return newData;
	}

	// 从 缓存 Map<fn, fn(this)> 中返回 fn(this)
	getFromUnorderedCache(fn) {
		if (this._cacheOrderIndependent === undefined) {
			this._cacheOrderIndependent = new Map();
		} else {
			const result = this._cacheOrderIndependent.get(fn);
			const data = /** @type {R} */ (result);
			if (data !== undefined) {
				return data;
			}
		}
		const newData = fn(this);
		this._cacheOrderIndependent.set(fn, newData);
		return newData;
	}

	// 清除缓存
	_invalidateCache() {
		if (this._cache !== undefined) {
			this._cache.clear();
		}
	}

	// 清除缓存
	_invalidateOrderedCache() {
		if (this._cacheOrderIndependent !== undefined) {
			this._cacheOrderIndependent.clear();
		}
	}

	/**
	 * @returns {T[]} the raw array
	 */
	toJSON() {
		return Array.from(this);
	}
}

module.exports = SortableSet;
