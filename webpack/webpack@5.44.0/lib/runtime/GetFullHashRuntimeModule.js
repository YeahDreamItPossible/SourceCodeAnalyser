"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");


// 运行时模块之返回完整的hash
class GetFullHashRuntimeModule extends RuntimeModule {
	constructor() {
		super("getFullHash");
		this.fullHash = true;
	}

	// __webpack_require__.h = 
	generate() {
		const { runtimeTemplate } = this.compilation;
		return `${RuntimeGlobals.getFullHash} = ${runtimeTemplate.returningFunction(
			JSON.stringify(this.compilation.hash || "XXXX")
		)}`;
	}
}

module.exports = GetFullHashRuntimeModule;
