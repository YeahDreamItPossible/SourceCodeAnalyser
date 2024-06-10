"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class AsyncSeriesLoopHookCodeFactory extends HookCodeFactory {
	content({ onError, onDone }) {
		return this.callTapsLooping({
			onError: (i, err, next, doneBreak) => onError(err) + doneBreak(true),
			onDone
		});
	}
}

const factory = new AsyncSeriesLoopHookCodeFactory();

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 异步串行循环钩子
 * 当串行执行注册事件队列时 
 * 如果事件队列中每个事件都返回 undefined 时 则将该队列执行完毕后退出
 * 如果事件队列中某个事件未返回 undefined 时 则重新开始从第一个事件开始执行事件队列 直至所有的事件都返回 undefined
 * 当执行某个事件出错时 则直接退出当前注册事件队列
 */
function AsyncSeriesLoopHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	hook.constructor = AsyncSeriesLoopHook;
	hook.compile = COMPILE;
	hook._call = undefined;
	hook.call = undefined;
	return hook;
}

AsyncSeriesLoopHook.prototype = null;

module.exports = AsyncSeriesLoopHook;
