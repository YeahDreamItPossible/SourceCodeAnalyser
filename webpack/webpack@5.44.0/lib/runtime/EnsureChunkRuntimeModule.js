"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const RuntimeModule = require("../RuntimeModule");
const Template = require("../Template");

// 运行时模块之保证块加载
// __webpack_require__.e
// 作用:
// 根据 chunkId 加载对应的 chunk 并缓存该 chunk
class EnsureChunkRuntimeModule extends RuntimeModule {
	constructor(runtimeRequirements) {
		super("ensure chunk");
		this.runtimeRequirements = runtimeRequirements;
	}

	generate() {
		const { runtimeTemplate } = this.compilation;
		// Check if there are non initial chunks which need to be imported using require-ensure
		if (this.runtimeRequirements.has(RuntimeGlobals.ensureChunkHandlers)) {
			const handlers = RuntimeGlobals.ensureChunkHandlers;
			return Template.asString([
				`${handlers} = {};`,
				"// This file contains only the entry chunk.",
				"// The chunk loading function for additional chunks",
				`${RuntimeGlobals.ensureChunk} = ${runtimeTemplate.basicFunction(
					"chunkId",
					[
						`return Promise.all(Object.keys(${handlers}).reduce(${runtimeTemplate.basicFunction(
							"promises, key",
							[`${handlers}[key](chunkId, promises);`, "return promises;"]
						)}, []));`
					]
				)};`
			]);
		} else {
			// There ensureChunk is used somewhere in the tree, so we need an empty requireEnsure
			// function. This can happen with multiple entrypoints.
			return Template.asString([
				"// The chunk loading function for additional chunks",
				"// Since all referenced chunks are already included",
				"// in this file, this function is empty here.",
				`${RuntimeGlobals.ensureChunk} = ${runtimeTemplate.returningFunction(
					"Promise.resolve()"
				)};`
			]);
		}
	}
}

module.exports = EnsureChunkRuntimeModule;

// 生成代码示例:
(() => {
	__webpack_require__.f = {};
	// This file contains only the entry chunk.
	// The chunk loading function for additional chunks
	__webpack_require__.e = (chunkId) => {
		return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
			__webpack_require__.f[key](chunkId, promises);
			return promises;
		}, []));
	}
})()