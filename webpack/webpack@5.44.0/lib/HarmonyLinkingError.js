"use strict";

const WebpackError = require("./WebpackError");

// ES链接错误
module.exports = class HarmonyLinkingError extends WebpackError {
	constructor(message) {
		super(message);
		this.name = "HarmonyLinkingError";
		this.hideStack = true;
	}
};
