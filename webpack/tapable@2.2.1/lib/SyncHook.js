// @ts-nocheck
/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
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

// 创建同步钩子的实例
function SyncHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	// 绑定实例的构造函数属性
	hook.constructor = SyncHook;

	/**
	 * 子类通过重载父类方法来保证该类型的子类无法调用该方法
	 * 即: SyncHook 不可通过tapAsync tapPromise注册事件
	 */
	hook.tapAsync = TAP_ASYNC;
	hook.tapPromise = TAP_PROMISE;

	// 重写父类编译代码的方式
	hook.compile = COMPILE;
	return hook;
}

SyncHook.prototype = null;

module.exports = SyncHook;
