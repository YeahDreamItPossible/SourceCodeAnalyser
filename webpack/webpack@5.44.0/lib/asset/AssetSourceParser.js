"use strict";

const Parser = require("../Parser");

// 导出资源的源代码 通过raw-loader实现
// Webpack.options.module.Rule.type = 'asset/source' 
class AssetSourceParser extends Parser {
	parse(source, state) {
		if (typeof source === "object" && !Buffer.isBuffer(source)) {
			throw new Error("AssetSourceParser doesn't accept preparsed AST");
		}
		const { module } = state;
		module.buildInfo.strict = true;
		module.buildMeta.exportsType = "default";

		return state;
	}
}

module.exports = AssetSourceParser;
