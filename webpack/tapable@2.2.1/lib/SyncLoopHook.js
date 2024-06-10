"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class SyncLoopHookCodeFactory extends HookCodeFactory {
	content({ onError, onDone, rethrowIfPossible }) {
		return this.callTapsLooping({
			onError: (i, err) => onError(err),
			onDone,
			rethrowIfPossible
		});
	}
}

const factory = new SyncLoopHookCodeFactory();

// 同步循环钩子禁用注册带有回调函数的异步事件
const TAP_ASYNC = () => {
	throw new Error("tapAsync is not supported on a SyncLoopHook");
};
// 同步循环钩子禁用注册返回值为Promise的异步事件
const TAP_PROMISE = () => {
	throw new Error("tapPromise is not supported on a SyncLoopHook");
};

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 同步循环钩子
 * 与 同步钩子(SyncHook) 区别:
 * 当依次执行注册事件队列中 
 * 如果事件队列中每个事件都返回 undefined 时 则将该队列执行完毕后退出
 * 如果事件队列中某个事件未返回 undefined 时 则重新开始从第一个事件开始执行事件队列 直至所有的事件都返回 undefined
 * 执行某事件时如果报错 则直接退出事件队列
 */
function SyncLoopHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	hook.constructor = SyncLoopHook;
	hook.tapAsync = TAP_ASYNC;
	hook.tapPromise = TAP_PROMISE;
	hook.compile = COMPILE;
	return hook;
}

SyncLoopHook.prototype = null;

module.exports = SyncLoopHook;
