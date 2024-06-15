"use strict";

const { compareChunksNatural } = require("../util/comparators");
const {
	getShortChunkName,
	getLongChunkName,
	assignNames,
	getUsedChunkIds,
	assignAscendingChunkIds
} = require("./IdHelpers");

// 给 chunk.id 设置 模块短路劲(相对路径)
// 根据 Webpack.options.optimization.chunkIds = 'named' 注册该插件
class NamedChunkIdsPlugin {
	constructor(options) {
		this.delimiter = (options && options.delimiter) || "-";
		this.context = options && options.context;
	}

	apply(compiler) {
		compiler.hooks.compilation.tap("NamedChunkIdsPlugin", compilation => {
			compilation.hooks.chunkIds.tap("NamedChunkIdsPlugin", chunks => {
				const chunkGraph = compilation.chunkGraph;
				const context = this.context ? this.context : compiler.context;
				const delimiter = this.delimiter;

				const unnamedChunks = assignNames(
					Array.from(chunks).filter(chunk => {
						if (chunk.name) {
							chunk.id = chunk.name;
							chunk.ids = [chunk.name];
						}
						return chunk.id === null;
					}),
					chunk =>
						getShortChunkName(
							chunk,
							chunkGraph,
							context,
							delimiter,
							compiler.root
						),
					chunk =>
						getLongChunkName(
							chunk,
							chunkGraph,
							context,
							delimiter,
							compiler.root
						),
					compareChunksNatural(chunkGraph),
					getUsedChunkIds(compilation),
					(chunk, name) => {
						chunk.id = name;
						chunk.ids = [name];
					}
				);
				if (unnamedChunks.length > 0) {
					assignAscendingChunkIds(unnamedChunks, compilation);
				}
			});
		});
	}
}

module.exports = NamedChunkIdsPlugin;
