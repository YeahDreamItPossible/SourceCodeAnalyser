"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class AsyncSeriesWaterfallHookCodeFactory extends HookCodeFactory {
	content({ onError, onResult, onDone }) {
		return this.callTapsSeries({
			onError: (i, err, next, doneBreak) => onError(err) + doneBreak(true),
			onResult: (i, result, next) => {
				let code = "";
				code += `if(${result} !== undefined) {\n`;
				code += `${this._args[0]} = ${result};\n`;
				code += `}\n`;
				code += next();
				return code;
			},
			onDone: () => onResult(this._args[0])
		});
	}
}

const factory = new AsyncSeriesWaterfallHookCodeFactory();

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

/**
 * 异步串行瀑布钩子
 * 当串行执行注册事件队列时 如果某个事件返回值不是 undefined 时
 * 则将该返回值作为下一个事件的参数 继续执行(不会退出当前注册事件队列)
 * 当执行某个事件出错时 则直接退出当前注册事件队列
 */
function AsyncSeriesWaterfallHook(args = [], name = undefined) {
	if (args.length < 1)
		throw new Error("Waterfall hooks must have at least one argument");
	const hook = new Hook(args, name);
	hook.constructor = AsyncSeriesWaterfallHook;
	hook.compile = COMPILE;
	hook._call = undefined;
	hook.call = undefined;
	return hook;
}

AsyncSeriesWaterfallHook.prototype = null;

module.exports = AsyncSeriesWaterfallHook;
