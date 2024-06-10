"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

// 代码生成
class SyncHookCodeFactory extends HookCodeFactory {
	content({ onError, onDone, rethrowIfPossible }) {
		return this.callTapsSeries({
			onError: (i, err) => onError(err),
			onDone,
			rethrowIfPossible
		});
	}
}

const factory = new SyncHookCodeFactory();

// 同步钩子禁用注册带有回调函数的异步事件
const TAP_ASYNC = () => {
	throw new Error("tapAsync is not supported on a SyncHook");
};
// 同步钩子禁用注册返回值为Promise的异步事件
const TAP_PROMISE = () => {
	throw new Error("tapPromise is not supported on a SyncHook");
};

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 同步钩子
 * 按照注册事件队列 依次执行
 */
function SyncHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	// 手动绑定constructor属性
	hook.constructor = SyncHook;

	/**
	 * 方法重写
	 * 子类通过重写父类方法 来实现子类特殊功能
	 * 同步钩子不可通过 tapAsync tapPromise 注册事件
	 */
	hook.tapAsync = TAP_ASYNC;
	hook.tapPromise = TAP_PROMISE;

	// 重写父类编译代码的方式
	hook.compile = COMPILE;
	return hook;
}

SyncHook.prototype = null;

module.exports = SyncHook;
