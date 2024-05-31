"use strict";

const { compareChunksNatural } = require("../util/comparators");
const { assignAscendingChunkIds } = require("./IdHelpers");

// 给 chunk.id 设置 按使用顺序的数字
// 根据 Webpack.Config.optimization.chunkIds = natural 注册该插件
class NaturalChunkIdsPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("NaturalChunkIdsPlugin", compilation => {
			compilation.hooks.chunkIds.tap("NaturalChunkIdsPlugin", chunks => {
				const chunkGraph = compilation.chunkGraph;
				const compareNatural = compareChunksNatural(chunkGraph);
				const chunksInNaturalOrder = Array.from(chunks).sort(compareNatural);
				assignAscendingChunkIds(chunksInNaturalOrder, compilation);
			});
		});
	}
}

module.exports = NaturalChunkIdsPlugin;
