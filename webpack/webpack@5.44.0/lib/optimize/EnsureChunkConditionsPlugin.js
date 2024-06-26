"use strict";

const { STAGE_BASIC } = require("../OptimizationStages");

// TODO:
// 1. 根据 Module 找到对应的 Chunk
//    筛选 不包含 运行时模块(EntryModule) 的 Chunk 解除此 Chunk 与 Module 的关联关系
// 2. 根据 Module 找到对应的 Chunk
//    找到包含当前 Chunk 的所有 ChunkGroup 
//    批量找到 ChunkGroup 下 运行时模块(EntryModule) 的 Chunk 绑定 Chunk 与 Module 的关联关系
class EnsureChunkConditionsPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"EnsureChunkConditionsPlugin",
			compilation => {
				const handler = chunks => {
					const chunkGraph = compilation.chunkGraph;
					// These sets are hoisted here to save memory
					// They are cleared at the end of every loop
					// Set<Chunk>
					const sourceChunks = new Set();
					// Set<ChunkGroup>
					const chunkGroups = new Set();
					for (const module of compilation.modules) {
						for (const chunk of chunkGraph.getModuleChunksIterable(module)) {
							// 针对于ExternalModule FallbackModule模块
							// 如果该模块所属于的chunk 不包含运行时模块(EntryModule)
							if (!module.chunkCondition(chunk, compilation)) {
								sourceChunks.add(chunk);
								for (const group of chunk.groupsIterable) {
									chunkGroups.add(group);
								}
							}
						}
						if (sourceChunks.size === 0) continue;
						// Set<Chunk>
						const targetChunks = new Set();
						chunkGroupLoop: for (const chunkGroup of chunkGroups) {
							// Can module be placed in a chunk of this group?
							for (const chunk of chunkGroup.chunks) {
								if (module.chunkCondition(chunk, compilation)) {
									targetChunks.add(chunk);
									continue chunkGroupLoop;
								}
							}
							// We reached the entrypoint: fail
							if (chunkGroup.isInitial()) {
								throw new Error(
									"Cannot fullfil chunk condition of " + module.identifier()
								);
							}
							// Try placing in all parents
							for (const group of chunkGroup.parentsIterable) {
								chunkGroups.add(group);
							}
						}
						for (const sourceChunk of sourceChunks) {
							chunkGraph.disconnectChunkAndModule(sourceChunk, module);
						}
						for (const targetChunk of targetChunks) {
							chunkGraph.connectChunkAndModule(targetChunk, module);
						}
						sourceChunks.clear();
						chunkGroups.clear();
					}
				};
				compilation.hooks.optimizeChunks.tap(
					{
						name: "EnsureChunkConditionsPlugin",
						stage: STAGE_BASIC
					},
					handler
				);
			}
		);
	}
}
module.exports = EnsureChunkConditionsPlugin;
