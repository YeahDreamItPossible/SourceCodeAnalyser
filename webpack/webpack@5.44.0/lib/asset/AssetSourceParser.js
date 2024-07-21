"use strict";

const Parser = require("../Parser");

// 根据 Webpack.options.module.Rule.type = 'asset/source'  注册该插件
// 源码资源语法分析器
// 作用:
// 导出资源的源代码 
// webpack5之前通过raw-loader实现
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
