"use strict";

const { RawSource } = require("webpack-sources");
const Generator = require("../Generator");
const RuntimeGlobals = require("../RuntimeGlobals");

const TYPES = new Set(["javascript"]);

// 根据 Webpack.options.module.Rule.type = 'asset/source' 注册该插件
// 源码资源代码生成器
// 作用:
// 导出资源的源代码(即: module.exprots = JSON.stringify('...') )
// webpack5之前通过raw-loader实现
class AssetSourceGenerator extends Generator {
	generate(module, { chunkGraph, runtimeTemplate, runtimeRequirements }) {
		runtimeRequirements.add(RuntimeGlobals.module);

		const originalSource = module.originalSource();

		if (!originalSource) {
			return new RawSource("");
		}

		const content = originalSource.source();

		let encodedSource;
		if (typeof content === "string") {
			encodedSource = content;
		} else {
			encodedSource = content.toString("utf-8");
		}
		return new RawSource(
			`${RuntimeGlobals.module}.exports = ${JSON.stringify(encodedSource)};`
		);
	}

	getTypes(module) {
		return TYPES;
	}

	getSize(module, type) {
		const originalSource = module.originalSource();

		if (!originalSource) {
			return 0;
		}

		// Example: m.exports="abcd"
		return originalSource.size() + 12;
	}
}

module.exports = AssetSourceGenerator;
