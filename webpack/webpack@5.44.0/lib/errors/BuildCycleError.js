"use strict";

const WebpackError = require("../WebpackError");

// 循环构建错误
class BuildCycleError extends WebpackError {
	constructor(module) {
		super(
			"There is a circular build dependency, which makes it impossible to create this module"
		);

		this.name = "BuildCycleError";
		this.module = module;
	}
}

module.exports = BuildCycleError;
