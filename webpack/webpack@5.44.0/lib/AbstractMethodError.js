"use strict";

const WebpackError = require("./WebpackError");
const CURRENT_METHOD_REGEXP = /at ([a-zA-Z0-9_.]*)/;

// 抽象方法 必须被重写
function createMessage(method) {
	return `Abstract method${method ? " " + method : ""}. Must be overridden.`;
}

function Message() {
	this.stack = undefined;
	// 非 标准属性
	// 用于在 Error 实例上创建 stack 属性
	// this.stack = 'Error\n    at ...'
	Error.captureStackTrace(this);
	const match = this.stack.split("\n")[3].match(CURRENT_METHOD_REGEXP);

	this.message = match && match[1] ? createMessage(match[1]) : createMessage();
}

// 抽象方法错误
class AbstractMethodError extends WebpackError {
	constructor() {
		super(new Message().message);
		this.name = "AbstractMethodError";
	}
}

module.exports = AbstractMethodError;
