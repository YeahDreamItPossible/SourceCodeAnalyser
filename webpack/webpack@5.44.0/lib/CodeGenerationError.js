"use strict";

const WebpackError = require("./WebpackError");

// 代码生成 错误
class CodeGenerationError extends WebpackError {
	/**
	 * Create a new CodeGenerationError
	 * @param {Module} module related module
	 * @param {Error} error Original error
	 */
	constructor(module, error) {
		super();

		this.name = "CodeGenerationError";
		this.error = error;
		this.message = error.message;
		this.details = error.stack;
		this.module = module;
	}
}

module.exports = CodeGenerationError;
