"use strict";

const { STAGE_ADVANCED } = require("../OptimizationStages");

// 当前插件已被 SplitChunkPlugin 替代
// 作用:
// 合并 Chunk
class AggressiveMergingPlugin {
	constructor(options) {
		if (
			(options !== undefined && typeof options !== "object") ||
			Array.isArray(options)
		) {
			throw new Error(
				"Argument should be an options object. To use defaults, pass in nothing.\nFor more info on options, see https://webpack.js.org/plugins/"
			);
		}
		this.options = options || {};
	}

	apply(compiler) {
		const options = this.options;
		const minSizeReduce = options.minSizeReduce || 1.5;

		compiler.hooks.thisCompilation.tap(
			"AggressiveMergingPlugin",
			compilation => {
				compilation.hooks.optimizeChunks.tap(
					{
						name: "AggressiveMergingPlugin",
						stage: STAGE_ADVANCED
					},
					chunks => {
						const chunkGraph = compilation.chunkGraph;
						// 先获取要合并Chunk的队列
						// Array<{a: Chunk, b: Chunk, improvement: number}>
						let combinations = [];
						for (const a of chunks) {
							if (a.canBeInitial()) continue;
							for (const b of chunks) {
								if (b.canBeInitial()) continue;
								if (b === a) break;
								if (!chunkGraph.canChunksBeIntegrated(a, b)) {
									continue;
								}
								const aSize = chunkGraph.getChunkSize(b, {
									chunkOverhead: 0
								});
								const bSize = chunkGraph.getChunkSize(a, {
									chunkOverhead: 0
								});
								const abSize = chunkGraph.getIntegratedChunksSize(b, a, {
									chunkOverhead: 0
								});
								const improvement = (aSize + bSize) / abSize;
								combinations.push({
									a,
									b,
									improvement
								});
							}
						}

						combinations.sort((a, b) => {
							return b.improvement - a.improvement;
						});

						const pair = combinations[0];

						if (!pair) return;
						if (pair.improvement < minSizeReduce) return;

						chunkGraph.integrateChunks(pair.b, pair.a);
						compilation.chunks.delete(pair.a);
						return true;
					}
				);
			}
		);
	}
}

module.exports = AggressiveMergingPlugin;
