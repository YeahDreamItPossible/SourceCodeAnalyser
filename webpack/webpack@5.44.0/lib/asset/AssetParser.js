"use strict";

const Parser = require("../Parser");

// 根据 Webpack.options.module.Rule.type = 'asset' | 'asset/resource' | 'asset/inline' 注册该插件
// 资源语法分析器
// 作用:
// asset/inline   => 将资源作为一个Data URL(Base64编码的URL)直接嵌入到生成的文件中
// asset/resource => 将 资源文件 复制到输出目录 并返回一个（相对于输出目录的）URL
class AssetParser extends Parser {
	constructor(dataUrlCondition) {
		super();
		this.dataUrlCondition = dataUrlCondition;
	}

	parse(source, state) {
		if (typeof source === "object" && !Buffer.isBuffer(source)) {
			throw new Error("AssetParser doesn't accept preparsed AST");
		}
		// 
		state.module.buildInfo.strict = true;
		state.module.buildMeta.exportsType = "default";

		// module.buildInfo.dataUrl 表示当前模块是否是以 Data URL 的方式被引入
		if (typeof this.dataUrlCondition === "function") {
			state.module.buildInfo.dataUrl = this.dataUrlCondition(source, {
				filename: state.module.matchResource || state.module.resource,
				module: state.module
			});
		} else if (typeof this.dataUrlCondition === "boolean") {
			state.module.buildInfo.dataUrl = this.dataUrlCondition;
		} else if (
			this.dataUrlCondition &&
			typeof this.dataUrlCondition === "object"
		) {
			state.module.buildInfo.dataUrl =
				Buffer.byteLength(source) <= this.dataUrlCondition.maxSize;
		} else {
			throw new Error("Unexpected dataUrlCondition type");
		}

		return state;
	}
}

module.exports = AssetParser;
