"use strict";

const memoize = require("../util/memoize");

// 标识
const LAZY_TARGET = Symbol("lazy serialization target");
const LAZY_SERIALIZED_VALUE = Symbol("lazy serialization data");

// 串行器中间件基类
class SerializerMiddleware {
	// 序列化
	serialize(data, context) {
		const AbstractMethodError = require("../AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 反序列化
	deserialize(data, context) {
		const AbstractMethodError = require("../AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 创建 懒函数
	static createLazy(value, target, options = {}, serializedValue) {
		if (SerializerMiddleware.isLazy(value, target)) return value;
		const fn = typeof value === "function" ? value : () => value;
		// 设置 懒函数目标
		fn[LAZY_TARGET] = target;
		// 设置 懒函数选项
		(fn).options = options;
		// 设置 懒函数序列化值
		fn[LAZY_SERIALIZED_VALUE] = serializedValue;
		return fn;
	}

	// 是否是懒函数
	static isLazy(fn, target) {
		if (typeof fn !== "function") return false;
		const t = fn[LAZY_TARGET];
		return target ? t === target : !!t;
	}

	// 返回 懒函数选项
	static getLazyOptions(fn) {
		if (typeof fn !== "function") return undefined;
		return /** @type {any} */ (fn).options;
	}

	// 返回 懒函数序列化值
	static getLazySerializedValue(fn) {
		if (typeof fn !== "function") return undefined;
		return fn[LAZY_SERIALIZED_VALUE];
	}

	
	// 设置 懒函数序列化值
	static setLazySerializedValue(fn, value) {
		fn[LAZY_SERIALIZED_VALUE] = value;
	}

	// 
	static serializeLazy(lazy, serialize) {
		const fn = memoize(() => {
			const r = lazy();
			if (r && typeof r.then === "function") {
				return r.then(data => data && serialize(data));
			}
			return serialize(r);
		});
		fn[LAZY_TARGET] = lazy[LAZY_TARGET];
		/** @type {any} */ (fn).options = /** @type {any} */ (lazy).options;
		lazy[LAZY_SERIALIZED_VALUE] = fn;
		return fn;
	}

	// 
	static deserializeLazy(lazy, deserialize) {
		const fn = memoize(() => {
			const r = lazy();
			if (r && typeof r.then === "function") {
				return r.then(data => deserialize(data));
			}
			return deserialize(r);
		});
		fn[LAZY_TARGET] = lazy[LAZY_TARGET];
		/** @type {any} */ (fn).options = /** @type {any} */ (lazy).options;
		fn[LAZY_SERIALIZED_VALUE] = lazy;
		return fn;
	}

	// 
	static unMemoizeLazy(lazy) {
		if (!SerializerMiddleware.isLazy(lazy)) return lazy;
		const fn = () => {
			throw new Error(
				"A lazy value that has been unmemorized can't be called again"
			);
		};
		fn[LAZY_SERIALIZED_VALUE] = SerializerMiddleware.unMemoizeLazy(
			lazy[LAZY_SERIALIZED_VALUE]
		);
		fn[LAZY_TARGET] = lazy[LAZY_TARGET];
		fn.options = /** @type {any} */ (lazy).options;
		return fn;
	}
}

module.exports = SerializerMiddleware;
