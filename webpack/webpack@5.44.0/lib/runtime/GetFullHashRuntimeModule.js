"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");

/** @typedef {import("../Compilation")} Compilation */

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
