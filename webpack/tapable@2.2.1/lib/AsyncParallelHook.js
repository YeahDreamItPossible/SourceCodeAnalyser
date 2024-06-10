"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class AsyncParallelHookCodeFactory extends HookCodeFactory {
	content({ onError, onDone }) {
		return this.callTapsParallel({
			onError: (i, err, done, doneBreak) => onError(err) + doneBreak(true),
			onDone
		});
	}
}

const factory = new AsyncParallelHookCodeFactory();

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 异步并行钩子
 * 按照注册事件队列 并行执行(不需要等待前一个事件执行完毕)
 * 与 异步串行钩子(AsyncSeriesHook) 区别：
 * 1. 允许所注册的异步事件同步执行 不需要等待前一个事件的执行结果
 * 2. 每个异步事件都是独立运行 不存在依赖关系
 */
function AsyncParallelHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	hook.constructor = AsyncParallelHook;
	hook.compile = COMPILE;
	hook._call = undefined;
	hook.call = undefined;
	return hook;
}

AsyncParallelHook.prototype = null;

module.exports = AsyncParallelHook;
