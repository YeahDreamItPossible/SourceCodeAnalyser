"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

// TODO:
class StartupChunkDependenciesRuntimeModule extends RuntimeModule {
	constructor(asyncChunkLoading) {
		super("startup chunk dependencies", RuntimeModule.STAGE_TRIGGER);
		this.asyncChunkLoading = asyncChunkLoading;
	}

	// 
	generate() {
		const { chunkGraph, chunk, compilation } = this;
		const { runtimeTemplate } = compilation;
		const chunkIds = Array.from(
			chunkGraph.getChunkEntryDependentChunksIterable(chunk)
		).map(chunk => {
			return chunk.id;
		});
		return Template.asString([
			`var next = ${RuntimeGlobals.startup};`,
			`${RuntimeGlobals.startup} = ${runtimeTemplate.basicFunction(
				"",
				!this.asyncChunkLoading
					? chunkIds
							.map(
								id => `${RuntimeGlobals.ensureChunk}(${JSON.stringify(id)});`
							)
							.concat("return next();")
					: chunkIds.length === 1
					? `return ${RuntimeGlobals.ensureChunk}(${JSON.stringify(
							chunkIds[0]
					  )}).then(next);`
					: chunkIds.length > 2
					? [
							// using map is shorter for 3 or more chunks
							`return Promise.all(${JSON.stringify(chunkIds)}.map(${
								RuntimeGlobals.ensureChunk
							}, __webpack_require__)).then(next);`
					  ]
					: [
							// calling ensureChunk directly is shorter for 0 - 2 chunks
							"return Promise.all([",
							Template.indent(
								chunkIds
									.map(
										id => `${RuntimeGlobals.ensureChunk}(${JSON.stringify(id)})`
									)
									.join(",\n")
							),
							"]).then(next);"
					  ]
			)};`
		]);
	}
}

module.exports = StartupChunkDependenciesRuntimeModule;
