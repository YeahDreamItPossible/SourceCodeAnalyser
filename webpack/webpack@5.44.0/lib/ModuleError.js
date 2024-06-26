"use strict";

const { cleanUp } = require("./ErrorHelpers");
const WebpackError = require("./WebpackError");
const makeSerializable = require("./util/makeSerializable");

// 模块错误
class ModuleError extends WebpackError {
	/**
	 * @param {Error} err error thrown
	 * @param {{from?: string|null}} info additional info
	 */
	constructor(err, { from = null } = {}) {
		let message = "Module Error";

		if (from) {
			message += ` (from ${from}):\n`;
		} else {
			message += ": ";
		}

		if (err && typeof err === "object" && err.message) {
			message += err.message;
		} else if (err) {
			message += err;
		}

		super(message);

		this.name = "ModuleError";
		this.error = err;
		this.details =
			err && typeof err === "object" && err.stack
				? cleanUp(err.stack, this.message)
				: undefined;
	}

	serialize(context) {
		const { write } = context;

		write(this.error);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.error = read();

		super.deserialize(context);
	}
}

makeSerializable(ModuleError, "webpack/lib/ModuleError");

module.exports = ModuleError;
