"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");

// __webpack_require__.p
class PublicPathRuntimeModule extends RuntimeModule {
	constructor(publicPath) {
		super("publicPath", RuntimeModule.STAGE_BASIC);
		this.publicPath = publicPath;
	}

	// __webpack_require__.p = xx
	generate() {
		const { compilation, publicPath } = this;

		return `${RuntimeGlobals.publicPath} = ${JSON.stringify(
			compilation.getPath(publicPath || "", {
				hash: compilation.hash || "XXXX"
			})
		)};`;
	}
}

module.exports = PublicPathRuntimeModule;
