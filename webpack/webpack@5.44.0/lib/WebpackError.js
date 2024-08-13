"use strict";

const inspect = require("util").inspect.custom;
const makeSerializable = require("./util/makeSerializable");

// 错误
// 作用:
// 在 webpack 整个编译过程中 抛出的错误应该是 WebpackError 的子类的实例
class WebpackError extends Error {
	constructor(message) {
		// 错误信息
		super(message);

		this.details = undefined;
		// 模块
		this.module = undefined;
		// 位置信息
		this.loc = undefined;
		// 标识: 是否隐藏错误栈信息
		this.hideStack = undefined;
		// 块
		this.chunk = undefined;
		// 文件
		this.file = undefined;
	}

	[inspect]() {
		return this.stack + (this.details ? `\n${this.details}` : "");
	}

	serialize({ write }) {
		write(this.name);
		write(this.message);
		write(this.stack);
		write(this.details);
		write(this.loc);
		write(this.hideStack);
	}

	deserialize({ read }) {
		this.name = read();
		this.message = read();
		this.stack = read();
		this.details = read();
		this.loc = read();
		this.hideStack = read();
	}
}

makeSerializable(WebpackError, "webpack/lib/WebpackError");

module.exports = WebpackError;
