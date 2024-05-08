"use strict";
const util = require("util");

// 警告: context字段废弃
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

/**
 * hook功能
 * 1. 注册事件(tap tapAsync tapPromise)
 * 2. 注册拦截器(interceptor)
 * 3. 调用事件(call callAsync callPromise)
 */

/**
 * 名词解释:
 * tap => 注册
 * call => 调用
 * interceptor => 拦截器
 * TapOption => 注册事件选项
 * InterceptOption => 拦截器选项
 * TapItem => 注册事件项(由TapOption 和 InterceptorOption 决定)
 */

/**
 * 注册事件选项 TapOption: 
 * {
 * 		name: String, // 可以用于调整 taps 优先列队项优先级
 * 		stage: Number, // 优先级
 * 		context: undefined, // 废弃
 * 		before: String || Array<String> // 调整
 * }
 */

/**
 * 拦截器选项 InterceptOption:
 * {
 * 		context: Object,
 * 		call: Function,
 * 		tap: Function,
 * 		register: Function,
 * 		error: Function,
 * 		done: Function,
 * 		result: Function,
 * }
 */

/**
 * 注册事件项 TapItem:
 * {
 * 		name: String,
 * 		type: String,
 * 		fn: Function,
 * 		stage: Number, // 优先级
 * 		before: String || Array<String> // 调整
 * }
 */

// 基类
class Hook {
	constructor(args = [], name = undefined) {
		// 注册事件的形参
		this._args = args;
		// 标识: 区分当前hook
		this.name = name;

		// 注册事件项
		// 优先队列 Array<TapItem>
		this.taps = [];
		// 拦截器选项
		// 队列 Array<InterceptorItem>
		this.interceptors = [];

		// 绑定函数体
		this._call = CALL_DELEGATE;
		this.call = CALL_DELEGATE;
		this._callAsync = CALL_ASYNC_DELEGATE;
		this.callAsync = CALL_ASYNC_DELEGATE;
		this._promise = PROMISE_DELEGATE;
		this.promise = PROMISE_DELEGATE;

		// 事件队列(call)
		this._x = undefined;

		// 绑定this
		this.compile = this.compile;
		this.tap = this.tap;
		this.tapAsync = this.tapAsync;
		this.tapPromise = this.tapPromise;
	}

	// 抽象方法
	// 生成call函数体
	compile(options) {
		throw new Error("Abstract: should be overridden");
	}

	// 根据调用类型(call type)生成内部call函数
	// 只有在call的时候 生成内部call函数的好处: 保证在该次调用时 选项是最终的不会再次改变
	_createCall(type) {
		return this.compile({
			taps: this.taps,
			interceptors: this.interceptors,
			args: this._args,
			type: type
		});
	}

	// 注册事件内部实现
	// 主要对注册事件选项正常化
	_tap(type, options, fn) {
		// 正常化options(normalize options)
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
		// options.context 废弃
		if (typeof options.context !== "undefined") {
			deprecateContext();
		}
		options = Object.assign({ type, fn }, options);
		options = this._runRegisterInterceptors(options);
		this._insert(options);
	}

	/**
	 * 注册事件的方式有三种
	 * 1. 注册同步事件
	 * 2. 注册带有回调函数的异步事件
	 * 3. 注册返回值为Promise的异步事件
	 */

	// 1. 注册同步事件
	// 同步事件fn的参数为this.args(即: Hook构造函数中传入的参数)
	// options: { name: String, stage: Number, before: String || Array<String> }
	tap(options, fn) {
		this._tap("sync", options, fn);
	}

	// 2. 注册带有回调函数的异步事件
	// 异步事件fn中最后一个形参为回调函数
	tapAsync(options, fn) {
		this._tap("async", options, fn);
	}

	// 3. 注册返回值为Promise的异步事件
	// 异步事件fn返回值为Promise
	tapPromise(options, fn) {
		this._tap("promise", options, fn);
	}

	// 调用拦截器 
	// 主要是调用拦截器选项中register属性 对注册事件选项进行加工处理 并得到最终的options
	// 即: 调用interceptor.register(tap.option)
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

	// 包装hook: 将options作为TapOption的默认options
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

	// 断言: 判断当前hook是否被使用(判断该hook中是否有注册事件或者拦截器)
	isUsed() {
		return this.taps.length > 0 || this.interceptors.length > 0;
	}

	// 注册拦截器
	// InterceptorOption: {context: Object, register: fn, call: fn, tap: fn, result: fn, error: fn, done: fn}
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

	// 重置编译器
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

// 原型
Object.setPrototypeOf(Hook.prototype, null);

module.exports = Hook;
