"use strict";

const RuntimeModule = require("../RuntimeModule");

class ExportWebpackRequireRuntimeModule extends RuntimeModule {
	constructor() {
		super("export webpack runtime", RuntimeModule.STAGE_ATTACH);
	}

	shouldIsolate() {
		return false;
	}

	generate() {
		return "export default __webpack_require__;";
	}
}

module.exports = ExportWebpackRequireRuntimeModule;
