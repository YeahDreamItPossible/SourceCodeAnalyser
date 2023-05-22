/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const util = require("util");

const deprecateContext = util.deprecate(() => {},
"Hook.context is deprecated and will be removed");

const CALL_DELEGATE = function(...args) {
	this.call = this._createCall("sync");
	return this.call(...args);
};

const CALL_ASYNC_DELEGATE = function(...args) {
	this.callAsync = this._createCall("async");
	return this.callAsync(...args);
};

const PROMISE_DELEGATE = function(...args) {
	this.promise = this._createCall("promise");
	return this.promise(...args);
};

class Hook {
	constructor(args = [], name = undefined) {
		this._args = args;
		this.name = name;

		// taps 事件优先队列
		// taps 中的item {name, type, fn, stage, before}
		// name 仅仅用于标识 可以用于调整 taps 优先列队项优先级
		this.taps = [];
		// interceptors 队列
		// 拦截器 的 item { register, call, error, result, done }
		this.interceptors = [];

		this._call = CALL_DELEGATE;
		this.call = CALL_DELEGATE;
		this._callAsync = CALL_ASYNC_DELEGATE;
		this.callAsync = CALL_ASYNC_DELEGATE;
		this._promise = PROMISE_DELEGATE;
		this.promise = PROMISE_DELEGATE;
		this._x = undefined;

		// NOTE:
		// 绑定
		this.compile = this.compile;
		this.tap = this.tap;
		this.tapAsync = this.tapAsync;
		this.tapPromise = this.tapPromise;
	}

	// 生成call函数体
	// 基类抽象方法
	compile(options) {
		throw new Error("Abstract: should be overridden");
	}

	// 根据 选项 编译成 内部call函数
	// 在call的时候 生成内部call函数的好处
	// 就是保证在该次调用时 选项是最终的 不会再次改变
	_createCall(type) {
		return this.compile({
			taps: this.taps,
			interceptors: this.interceptors,
			args: this._args,
			type: type
		});
	}

	// 主要对注册事件选项正常化
	_tap(type, options, fn) {
		// normalize options
		// 保证最终的options 是一个包含 { name, type, fn, before, stage, context } 的对象
		// 其中 context 废弃
		if (typeof options === "string") {
			options = {
				name: options.trim()
			};
		} else if (typeof options !== "object" || options === null) {
			throw new Error("Invalid tap options");
		}
		if (typeof options.name !== "string" || options.name === "") {
			throw new Error("Missing name for tap");
		}
		if (typeof options.context !== "undefined") {
			deprecateContext();
		}
		options = Object.assign({ type, fn }, options);
		options = this._runRegisterInterceptors(options);
		this._insert(options);
	}

	// 注册事件
	// 注册同步事件(fn函数的参数为Hook构造函数中传入的参数)
	tap(options, fn) {
		this._tap("sync", options, fn);
	}

	// 注册事件
	// 注册带有回调函数的异步事件(fn中最后一个形参为回掉函数)
	tapAsync(options, fn) {
		this._tap("async", options, fn);
	}

	// 注册事件
	// 注册返回值为Promise的异步事件(fn返回Promise)
	tapPromise(options, fn) {
		this._tap("promise", options, fn);
	}

	// 调用拦截器 处理options 并得到最终的options
	_runRegisterInterceptors(options) {
		for (const interceptor of this.interceptors) {
			if (interceptor.register) {
				const newOptions = interceptor.register(options);
				if (newOptions !== undefined) {
					options = newOptions;
				}
			}
		}
		return options;
	}

	// 将options作为默认options 对hook进行包装
	withOptions(options) {
		const mergeOptions = opt =>
			Object.assign({}, options, typeof opt === "string" ? { name: opt } : opt);

		return {
			name: this.name,
			tap: (opt, fn) => this.tap(mergeOptions(opt), fn),
			tapAsync: (opt, fn) => this.tapAsync(mergeOptions(opt), fn),
			tapPromise: (opt, fn) => this.tapPromise(mergeOptions(opt), fn),
			intercept: interceptor => this.intercept(interceptor),
			isUsed: () => this.isUsed(),
			withOptions: opt => this.withOptions(mergeOptions(opt))
		};
	}

	// 断言: 判断当前hook 是否被注册事件 or 拦截器
	isUsed() {
		return this.taps.length > 0 || this.interceptors.length > 0;
	}

	// 注册拦截器
	// interceptor: {context: {}, register: fn, call: fn, tap: fn, result: fn, error: fn, done: fn}
	intercept(interceptor) {
		this._resetCompilation();
		this.interceptors.push(Object.assign({}, interceptor));
		if (interceptor.register) {
			for (let i = 0; i < this.taps.length; i++) {
				// 每次注册拦截器时 都会对taps 中的item options 重新处理一次
				this.taps[i] = interceptor.register(this.taps[i]);
			}
		}
	}

	_resetCompilation() {
		this.call = this._call;
		this.callAsync = this._callAsync;
		this.promise = this._promise;
	}

	// 注册事件到 taps 队列 中 并调整每一项优先级
	_insert(item) {
		this._resetCompilation();
		let before;
		if (typeof item.before === "string") {
			before = new Set([item.before]);
		} else if (Array.isArray(item.before)) {
			before = new Set(item.before);
		}
		let stage = 0;
		if (typeof item.stage === "number") {
			stage = item.stage;
		}
		let i = this.taps.length;
		// 事件优先级调整
		while (i > 0) {
			i--;
			const x = this.taps[i];
			this.taps[i + 1] = x;
			const xStage = x.stage || 0;
			if (before) {
				if (before.has(x.name)) {
					before.delete(x.name);
					continue;
				}
				if (before.size > 0) {
					continue;
				}
			}
			if (xStage > stage) {
				continue;
			}
			i++;
			break;
		}
		this.taps[i] = item;
	}
}

Object.setPrototypeOf(Hook.prototype, null);

module.exports = Hook;
