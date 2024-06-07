"use strict";

const {
	compareModulesByPreOrderIndexOrIdentifier
} = require("../util/comparators");
const { assignAscendingModuleIds } = require("./IdHelpers");

// 给 Module 对应的 ChunkGraphModule 设置 id(按使用顺序的数字 id)
// 即： chunkGraphModule.id = Number(从 0 开始)
// 根据 Webpack.Config.optimization.moduleIds = 'natural' 注册该插件
class NaturalModuleIdsPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("NaturalModuleIdsPlugin", compilation => {
			compilation.hooks.moduleIds.tap("NaturalModuleIdsPlugin", modules => {
				const chunkGraph = compilation.chunkGraph;
				// 过滤 并排序
				const modulesInNaturalOrder = Array.from(modules)
					.filter(
						m =>
							m.needId &&
							chunkGraph.getNumberOfModuleChunks(m) > 0 &&
							chunkGraph.getModuleId(m) === null
					)
					.sort(
						compareModulesByPreOrderIndexOrIdentifier(compilation.moduleGraph)
					);
				assignAscendingModuleIds(modulesInNaturalOrder, compilation);
			});
		});
	}
}

module.exports = NaturalModuleIdsPlugin;
