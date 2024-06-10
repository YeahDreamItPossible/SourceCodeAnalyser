"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class AsyncSeriesHookCodeFactory extends HookCodeFactory {
	content({ onError, onDone }) {
		return this.callTapsSeries({
			onError: (i, err, next, doneBreak) => onError(err) + doneBreak(true),
			onDone
		});
	}
}

const factory = new AsyncSeriesHookCodeFactory();

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 异步串行钩子
 * 按照注册事件队列 串行执行(必须等上一个事件执行完毕后 再执行下一个事件)
 * 与 同步钩子(SyncHook) 区别:
 * 1. 同步钩子不会关心上一个事件的执行结果
 */
function AsyncSeriesHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	hook.constructor = AsyncSeriesHook;

	// 
	hook.compile = COMPILE;

	// AsyncSeriesHook 不可通过call调用
	hook._call = undefined;
	hook.call = undefined;
	return hook;
}

AsyncSeriesHook.prototype = null;

module.exports = AsyncSeriesHook;
