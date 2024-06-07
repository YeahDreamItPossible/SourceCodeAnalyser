"use strict";

const { compareChunksNatural } = require("../util/comparators");
const {
	getFullChunkName,
	getUsedChunkIds,
	assignDeterministicIds
} = require("./IdHelpers");

// 给 chunk.id 设置 xx(基于内容的确定性哈希)
// 根据 Webpack.Config.optimization.chunkIds = 'deterministic' 注册该插件
class DeterministicChunkIdsPlugin {
	constructor(options) {
		this.options = options || {};
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"DeterministicChunkIdsPlugin",
			compilation => {
				compilation.hooks.chunkIds.tap(
					"DeterministicChunkIdsPlugin",
					chunks => {
						const chunkGraph = compilation.chunkGraph;
						const context = this.options.context
							? this.options.context
							: compiler.context;
						const maxLength = this.options.maxLength || 3;

						const compareNatural = compareChunksNatural(chunkGraph);

						const usedIds = getUsedChunkIds(compilation);
						assignDeterministicIds(
							Array.from(chunks).filter(chunk => {
								return chunk.id === null;
							}),
							chunk =>
								getFullChunkName(chunk, chunkGraph, context, compiler.root),
							compareNatural,
							(chunk, id) => {
								const size = usedIds.size;
								usedIds.add(`${id}`);
								if (size === usedIds.size) return false;
								chunk.id = id;
								chunk.ids = [id];
								return true;
							},
							[Math.pow(10, maxLength)],
							10,
							usedIds.size
						);
					}
				);
			}
		);
	}
}

module.exports = DeterministicChunkIdsPlugin;
