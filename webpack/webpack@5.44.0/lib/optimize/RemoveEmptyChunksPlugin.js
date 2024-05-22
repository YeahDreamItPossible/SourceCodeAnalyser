"use strict";

const { STAGE_BASIC, STAGE_ADVANCED } = require("../OptimizationStages");

class RemoveEmptyChunksPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("RemoveEmptyChunksPlugin", compilation => {
			const handler = chunks => {
				const chunkGraph = compilation.chunkGraph;
				for (const chunk of chunks) {
					if (
						// 当前 ChunkGraphChunk 没有包含任何的Module
						chunkGraph.getNumberOfChunkModules(chunk) === 0 &&
						// 
						!chunk.hasRuntime() &&
						// 当前 ChunkGraphChunk 没有包含任何的 EntryModule
						chunkGraph.getNumberOfEntryModules(chunk) === 0
					) {
						compilation.chunkGraph.disconnectChunk(chunk);
						compilation.chunks.delete(chunk);
					}
				}
			};

			compilation.hooks.optimizeChunks.tap(
				{
					name: "RemoveEmptyChunksPlugin",
					stage: STAGE_BASIC
				},
				handler
			);
			compilation.hooks.optimizeChunks.tap(
				{
					name: "RemoveEmptyChunksPlugin",
					stage: STAGE_ADVANCED
				},
				handler
			);
		});
	}
}
module.exports = RemoveEmptyChunksPlugin;
