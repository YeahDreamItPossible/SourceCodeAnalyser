"use strict";

const { STAGE_BASIC } = require("../OptimizationStages");
const Queue = require("../util/Queue");
const { intersect } = require("../util/SetHelpers");

// 如果模块已经包含在所有父级模块中，告知 webpack 从 chunk 中检测出这些模块，或移除这些模块。
// 将 optimization.removeAvailableModules 设置为 true 以启用这项优化。
// 在 production 模式 中默认会被开启。
// 根据 Webpack.options.optimization.removeAvailableModules 注册该插件
class RemoveParentModulesPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("RemoveParentModulesPlugin", compilation => {
			const handler = (chunks, chunkGroups) => {
				const chunkGraph = compilation.chunkGraph;
				const queue = new Queue();
				const availableModulesMap = new WeakMap();

				for (const chunkGroup of compilation.entrypoints.values()) {
					// initialize available modules for chunks without parents
					availableModulesMap.set(chunkGroup, new Set());
					for (const child of chunkGroup.childrenIterable) {
						queue.enqueue(child);
					}
				}
				for (const chunkGroup of compilation.asyncEntrypoints) {
					// initialize available modules for chunks without parents
					availableModulesMap.set(chunkGroup, new Set());
					for (const child of chunkGroup.childrenIterable) {
						queue.enqueue(child);
					}
				}

				while (queue.length > 0) {
					const chunkGroup = queue.dequeue();
					let availableModules = availableModulesMap.get(chunkGroup);
					let changed = false;
					for (const parent of chunkGroup.parentsIterable) {
						const availableModulesInParent = availableModulesMap.get(parent);
						if (availableModulesInParent !== undefined) {
							// If we know the available modules in parent: process these
							if (availableModules === undefined) {
								// if we have not own info yet: create new entry
								availableModules = new Set(availableModulesInParent);
								for (const chunk of parent.chunks) {
									for (const m of chunkGraph.getChunkModulesIterable(chunk)) {
										availableModules.add(m);
									}
								}
								availableModulesMap.set(chunkGroup, availableModules);
								changed = true;
							} else {
								for (const m of availableModules) {
									if (
										!chunkGraph.isModuleInChunkGroup(m, parent) &&
										!availableModulesInParent.has(m)
									) {
										availableModules.delete(m);
										changed = true;
									}
								}
							}
						}
					}
					if (changed) {
						// if something changed: enqueue our children
						for (const child of chunkGroup.childrenIterable) {
							queue.enqueue(child);
						}
					}
				}

				// now we have available modules for every chunk
				for (const chunk of chunks) {
					const availableModulesSets = Array.from(
						chunk.groupsIterable,
						chunkGroup => availableModulesMap.get(chunkGroup)
					);
					if (availableModulesSets.some(s => s === undefined)) continue; // No info about this chunk group
					const availableModules =
						availableModulesSets.length === 1
							? availableModulesSets[0]
							: intersect(availableModulesSets);
					const numberOfModules = chunkGraph.getNumberOfChunkModules(chunk);
					const toRemove = new Set();
					if (numberOfModules < availableModules.size) {
						for (const m of chunkGraph.getChunkModulesIterable(chunk)) {
							if (availableModules.has(m)) {
								toRemove.add(m);
							}
						}
					} else {
						for (const m of availableModules) {
							if (chunkGraph.isModuleInChunk(m, chunk)) {
								toRemove.add(m);
							}
						}
					}
					for (const module of toRemove) {
						chunkGraph.disconnectChunkAndModule(chunk, module);
					}
				}
			};
			compilation.hooks.optimizeChunks.tap(
				{
					name: "RemoveParentModulesPlugin",
					stage: STAGE_BASIC
				},
				handler
			);
		});
	}
}
module.exports = RemoveParentModulesPlugin;
