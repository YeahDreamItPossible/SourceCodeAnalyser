"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const ChunkPrefetchFunctionRuntimeModule = require("./ChunkPrefetchFunctionRuntimeModule");
const ChunkPrefetchStartupRuntimeModule = require("./ChunkPrefetchStartupRuntimeModule");
const ChunkPrefetchTriggerRuntimeModule = require("./ChunkPrefetchTriggerRuntimeModule");
const ChunkPreloadTriggerRuntimeModule = require("./ChunkPreloadTriggerRuntimeModule");

class ChunkPrefetchPreloadPlugin {
	
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"ChunkPrefetchPreloadPlugin",
			compilation => {
				compilation.hooks.additionalChunkRuntimeRequirements.tap(
					"ChunkPrefetchPreloadPlugin",
					(chunk, set, { chunkGraph }) => {
						if (chunkGraph.getNumberOfEntryModules(chunk) === 0) return;
						const startupChildChunks = chunk.getChildrenOfTypeInOrder(
							chunkGraph,
							"prefetchOrder"
						);
						if (startupChildChunks) {
							set.add(RuntimeGlobals.prefetchChunk);
							set.add(RuntimeGlobals.onChunksLoaded);
							compilation.addRuntimeModule(
								chunk,
								new ChunkPrefetchStartupRuntimeModule(startupChildChunks)
							);
						}
					}
				);
				compilation.hooks.additionalTreeRuntimeRequirements.tap(
					"ChunkPrefetchPreloadPlugin",
					(chunk, set, { chunkGraph }) => {
						const chunkMap = chunk.getChildIdsByOrdersMap(chunkGraph, false);

						if (chunkMap.prefetch) {
							set.add(RuntimeGlobals.prefetchChunk);
							compilation.addRuntimeModule(
								chunk,
								new ChunkPrefetchTriggerRuntimeModule(chunkMap.prefetch)
							);
						}
						if (chunkMap.preload) {
							set.add(RuntimeGlobals.preloadChunk);
							compilation.addRuntimeModule(
								chunk,
								new ChunkPreloadTriggerRuntimeModule(chunkMap.preload)
							);
						}
					}
				);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.prefetchChunk)
					.tap("ChunkPrefetchPreloadPlugin", (chunk, set) => {
						compilation.addRuntimeModule(
							chunk,
							new ChunkPrefetchFunctionRuntimeModule(
								"prefetch",
								RuntimeGlobals.prefetchChunk,
								RuntimeGlobals.prefetchChunkHandlers
							)
						);
						set.add(RuntimeGlobals.prefetchChunkHandlers);
					});
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.preloadChunk)
					.tap("ChunkPrefetchPreloadPlugin", (chunk, set) => {
						compilation.addRuntimeModule(
							chunk,
							new ChunkPrefetchFunctionRuntimeModule(
								"preload",
								RuntimeGlobals.preloadChunk,
								RuntimeGlobals.preloadChunkHandlers
							)
						);
						set.add(RuntimeGlobals.preloadChunkHandlers);
					});
			}
		);
	}
}

module.exports = ChunkPrefetchPreloadPlugin;
