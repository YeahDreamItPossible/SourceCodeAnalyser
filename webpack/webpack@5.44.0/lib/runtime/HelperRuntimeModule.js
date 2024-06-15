"use strict";

const RuntimeModule = require("../RuntimeModule");

// 辅助运行时模块
class HelperRuntimeModule extends RuntimeModule {
	constructor(name) {
		super(name);
	}
}

module.exports = HelperRuntimeModule;
