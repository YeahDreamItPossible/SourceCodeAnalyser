"use strict";

const { STAGE_BASIC } = require("../OptimizationStages");
const { runtimeEqual } = require("../util/runtime");

// 合并含有相同模块的重复块
// 根据 Webpack.options.optimization.mergeDuplicateChunks 注册该插件
class MergeDuplicateChunksPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"MergeDuplicateChunksPlugin",
			compilation => {
				compilation.hooks.optimizeChunks.tap(
					{
						name: "MergeDuplicateChunksPlugin",
						stage: STAGE_BASIC
					},
					chunks => {
						const { chunkGraph, moduleGraph } = compilation;

						// 重复块集合
						// Set<Chunk>
						const notDuplicates = new Set();

						// 遍历所有的Chunk
						for (const chunk of chunks) {
							// track a Set of all chunk that could be duplicates
							let possibleDuplicates;
							// 遍历当前 Chunk 包含的所有的 Module
							for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
								if (possibleDuplicates === undefined) {
									// 遍历包含当前 Module 的所有 Chunk
									for (const dup of chunkGraph.getModuleChunksIterable(
										module
									)) {
										if (
											// 两个 Chunk 不同
											dup !== chunk &&
											// 两个 Chunk 包含的 Module 数量相同
											chunkGraph.getNumberOfChunkModules(chunk) ===
												chunkGraph.getNumberOfChunkModules(dup) &&
											!notDuplicates.has(dup)
										) {
											if (possibleDuplicates === undefined) {
												possibleDuplicates = new Set();
											}
											possibleDuplicates.add(dup);
										}
									}
									// when no chunk is possible we can break here
									if (possibleDuplicates === undefined) break;
								} else {
									for (const dup of possibleDuplicates) {
										// 当 当前 Chunk 不包含当前 Module 时 说明当前 Chunk 不是重复块
										if (!chunkGraph.isModuleInChunk(module, dup)) {
											possibleDuplicates.delete(dup);
										}
									}
									// when all chunks has been removed we can break here
									if (possibleDuplicates.size === 0) break;
								}
							}

							// when we found duplicates
							if (
								possibleDuplicates !== undefined &&
								possibleDuplicates.size > 0
							) {
								outer: for (const otherChunk of possibleDuplicates) {
									// 如果两个 Chunk 都是运行时块
									if (otherChunk.hasRuntime() !== chunk.hasRuntime()) continue;
									// 如果当前 Chunk 存在运行时模块 
									if (chunkGraph.getNumberOfEntryModules(chunk) > 0) continue;
									if (chunkGraph.getNumberOfEntryModules(otherChunk) > 0)
										continue;
									// 如果这两个 Chunk.runtime 同名
									if (!runtimeEqual(chunk.runtime, otherChunk.runtime)) {
										for (const module of chunkGraph.getChunkModulesIterable(
											chunk
										)) {
											const exportsInfo = moduleGraph.getExportsInfo(module);
											if (
												!exportsInfo.isEquallyUsed(
													chunk.runtime,
													otherChunk.runtime
												)
											) {
												continue outer;
											}
										}
									}
									// 合并块
									if (chunkGraph.canChunksBeIntegrated(chunk, otherChunk)) {
										chunkGraph.integrateChunks(chunk, otherChunk);
										compilation.chunks.delete(otherChunk);
									}
								}
							}

							// don't check already processed chunks twice
							notDuplicates.add(chunk);
						}
					}
				);
			}
		);
	}
}
module.exports = MergeDuplicateChunksPlugin;
