"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

// 通过自定义 onResult 方法 来判断上一个事件返回值是否是 undefined
// 如果返回不是 undefined 则直接退出当前注册事件队列 并返回当前事件返回值
class SyncBailHookCodeFactory extends HookCodeFactory {
	content({ onError, onResult, resultReturns, onDone, rethrowIfPossible }) {
		return this.callTapsSeries({
			onError: (i, err) => onError(err),
			onResult: (i, result, next) =>
				`if(${result} !== undefined) {\n${onResult(
					result
				)};\n} else {\n${next()}}\n`,
			resultReturns,
			onDone,
			rethrowIfPossible
		});
	}
}

const factory = new SyncBailHookCodeFactory();

// 同步拦截钩子禁用注册带有回调函数的异步事件
const TAP_ASYNC = () => {
	throw new Error("tapAsync is not supported on a SyncBailHook");
};
// 同步拦截钩子禁用注册返回值为Promise的异步事件
const TAP_PROMISE = () => {
	throw new Error("tapPromise is not supported on a SyncBailHook");
};

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 同步拦截钩子
 * 与 同步钩子(SyncHook) 区别:
 * 当依次执行注册事件队列时 如果某个事件返回值不是 undefined 时
 * 直接退出当前注册事件队列 并返回当前事件返回值
 */
function SyncBailHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	hook.constructor = SyncBailHook;
	hook.tapAsync = TAP_ASYNC;
	hook.tapPromise = TAP_PROMISE;
	hook.compile = COMPILE;
	return hook;
}

SyncBailHook.prototype = null;

module.exports = SyncBailHook;
