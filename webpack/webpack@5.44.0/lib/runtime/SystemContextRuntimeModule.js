"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");

// __webpack_require__.y
class SystemContextRuntimeModule extends RuntimeModule {
	constructor() {
		super("__system_context__");
	}

	generate() {
		// __webpack_require__.y = __system_context__;
		return `${RuntimeGlobals.systemContext} = __system_context__;`;
	}
}

module.exports = SystemContextRuntimeModule;
