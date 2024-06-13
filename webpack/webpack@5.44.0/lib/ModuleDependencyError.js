"use strict";

const WebpackError = require("./WebpackError");

// 模块依赖错误
class ModuleDependencyError extends WebpackError {
	constructor(module, err, loc) {
		super(err.message);

		this.name = "ModuleDependencyError";
		this.details =
			err && !(/** @type {any} */ (err).hideStack)
				? err.stack.split("\n").slice(1).join("\n")
				: undefined;
		this.module = module;
		this.loc = loc;
		/** error is not (de)serialized, so it might be undefined after deserialization */
		this.error = err;

		if (err && /** @type {any} */ (err).hideStack) {
			this.stack =
				err.stack.split("\n").slice(1).join("\n") + "\n\n" + this.stack;
		}
	}
}

module.exports = ModuleDependencyError;
