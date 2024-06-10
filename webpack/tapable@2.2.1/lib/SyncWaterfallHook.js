"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

// 自定义 onResult 方法 来判断 上一个事件返回值是否是 undefined
// 如果不是 undefined 会作为下一个事件的参数
class SyncWaterfallHookCodeFactory extends HookCodeFactory {
	content({ onError, onResult, resultReturns, rethrowIfPossible }) {
		return this.callTapsSeries({
			onError: (i, err) => onError(err),
			onResult: (i, result, next) => {
				let code = "";
				code += `if(${result} !== undefined) {\n`;
				code += `${this._args[0]} = ${result};\n`;
				code += `}\n`;
				code += next();
				return code;
			},
			onDone: () => onResult(this._args[0]),
			doneReturns: resultReturns,
			rethrowIfPossible
		});
	}
}

const factory = new SyncWaterfallHookCodeFactory();

// 同步瀑布钩子禁用注册带有回调函数的异步事件
const TAP_ASYNC = () => {
	throw new Error("tapAsync is not supported on a SyncWaterfallHook");
};
// 同步瀑布钩子禁用注册返回值为Promise的异步事件
const TAP_PROMISE = () => {
	throw new Error("tapPromise is not supported on a SyncWaterfallHook");
};

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 同步瀑布钩子
 * 与 同步钩子(SyncHook) 区别:
 * 当依次执行注册事件队列中 
 * 每个事件会将前一个事件返回值(不能是 undefined)作为参数
 * 并且会当前事件返回值传递给下一个事件作为参数
 */
function SyncWaterfallHook(args = [], name = undefined) {
	if (args.length < 1)
		throw new Error("Waterfall hooks must have at least one argument");
	const hook = new Hook(args, name);
	hook.constructor = SyncWaterfallHook;
	hook.tapAsync = TAP_ASYNC;
	hook.tapPromise = TAP_PROMISE;
	hook.compile = COMPILE;
	return hook;
}

SyncWaterfallHook.prototype = null;

module.exports = SyncWaterfallHook;
