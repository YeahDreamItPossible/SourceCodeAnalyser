"use strict";

const WebpackError = require("./WebpackError");

// 同时存在编译过程错误
module.exports = class ConcurrentCompilationError extends WebpackError {
	constructor() {
		super();

		this.name = "ConcurrentCompilationError";
		this.message =
			"You ran Webpack twice. Each instance only supports a single concurrent compilation at a time.";
	}
};
