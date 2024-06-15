"use strict";

const { STAGE_BASIC, STAGE_ADVANCED } = require("../OptimizationStages");

// 移除空块
// 根据 Webpack.options.optimization.removeEmptyChunks 注册该插件
class RemoveEmptyChunksPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("RemoveEmptyChunksPlugin", compilation => {
			const handler = chunks => {
				const chunkGraph = compilation.chunkGraph;
				for (const chunk of chunks) {
					if (
						// 当前 ChunkGraphChunk 没有包含任何的Module
						chunkGraph.getNumberOfChunkModules(chunk) === 0 &&
						// 当前 CHunk 没有运行时模块
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
