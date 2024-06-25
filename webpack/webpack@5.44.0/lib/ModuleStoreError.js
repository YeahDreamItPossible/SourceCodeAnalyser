"use strict";

const WebpackError = require("./WebpackError");

// 模块存储错误
class ModuleStoreError extends WebpackError {
	/**
	 * @param {Module} module module tied to dependency
	 * @param {string | Error} err error thrown
	 */
	constructor(module, err) {
		let message = "Module storing failed: ";
		let details = undefined;
		if (err !== null && typeof err === "object") {
			if (typeof err.stack === "string" && err.stack) {
				const stack = err.stack;
				message += stack;
			} else if (typeof err.message === "string" && err.message) {
				message += err.message;
			} else {
				message += err;
			}
		} else {
			message += String(err);
		}

		super(message);

		this.name = "ModuleStoreError";
		this.details = details;
		this.module = module;
		this.error = err;
	}
}

module.exports = ModuleStoreError;
