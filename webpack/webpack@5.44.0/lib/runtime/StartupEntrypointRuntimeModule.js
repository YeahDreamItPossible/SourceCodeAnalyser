"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");

class StartupEntrypointRuntimeModule extends RuntimeModule {
	constructor(asyncChunkLoading) {
		super("startup entrypoint");
		this.asyncChunkLoading = asyncChunkLoading;
	}

	generate() {
		const { compilation } = this;
		const { runtimeTemplate } = compilation;
		// __webpack_require__.X = function (result, chunkIds, fn) {}
		return `${
			RuntimeGlobals.startupEntrypoint
		} = ${runtimeTemplate.basicFunction("result, chunkIds, fn", [
			"// arguments: chunkIds, moduleId are deprecated",
			"var moduleId = chunkIds;",
			`if(!fn) chunkIds = result, fn = ${runtimeTemplate.returningFunction(
				`__webpack_require__(${RuntimeGlobals.entryModuleId} = moduleId)`
			)};`,
			...(this.asyncChunkLoading
				? [
						`return Promise.all(chunkIds.map(${
							RuntimeGlobals.ensureChunk
						}, __webpack_require__)).then(${runtimeTemplate.basicFunction("", [
							"var r = fn();",
							"return r === undefined ? result : r;"
						])})`
				  ]
				: [
						`chunkIds.map(${RuntimeGlobals.ensureChunk}, __webpack_require__)`,
						"var r = fn();",
						"return r === undefined ? result : r;"
				  ])
		])}`;
	}
}

module.exports = StartupEntrypointRuntimeModule;
