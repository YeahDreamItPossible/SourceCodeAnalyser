"use strict";

// 串行器
// 作用:
// 依次执行 中间件队列 并以 Promise 的方式返回结果
class Serializer {
	constructor(middlewares, context) {
		// 序列化 中间件
		this.serializeMiddlewares = middlewares.slice();
		// 反序列化 中间件
		this.deserializeMiddlewares = middlewares.slice().reverse();
		// 上下文
		this.context = context;
	}

	// 依次执行 序列化中间件队列 并以 Promise 的方式返回结果
	serialize(obj, context) {
		const ctx = { ...context, ...this.context };
		let current = obj;
		for (const middleware of this.serializeMiddlewares) {
			if (current && typeof current.then === "function") {
				current = current.then(
					data => data && middleware.serialize(data, context)
				);
			} else if (current) {
				try {
					current = middleware.serialize(current, ctx);
				} catch (err) {
					current = Promise.reject(err);
				}
			} else break;
		}
		return current;
	}

	// 依次执行 反序列化中间件队列 并以 Promise 的方式返回结果
	deserialize(value, context) {
		const ctx = { ...context, ...this.context };
		/** @type {any} */
		let current = value;
		for (const middleware of this.deserializeMiddlewares) {
			if (current && typeof current.then === "function") {
				current = current.then(data => middleware.deserialize(data, context));
			} else {
				current = middleware.deserialize(current, ctx);
			}
		}
		return current;
	}
}

module.exports = Serializer;
