"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");

// __webpack_require__.cn
class ChunkNameRuntimeModule extends RuntimeModule {
	constructor(chunkName) {
		super("chunkName");
		this.chunkName = chunkName;
	}

	// __webpack_require__.cn
	generate() {
		return `${RuntimeGlobals.chunkName} = ${JSON.stringify(this.chunkName)};`;
	}
}

module.exports = ChunkNameRuntimeModule;
