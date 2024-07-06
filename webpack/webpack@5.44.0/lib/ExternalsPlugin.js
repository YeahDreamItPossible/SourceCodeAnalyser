"use strict";

const ExternalModuleFactoryPlugin = require("./ExternalModuleFactoryPlugin");

// 外部扩展插件
// 从输出的 bundle 中排除依赖(以cdn的方式引入的依赖)
// 根据 Webpack.options.externals 和 Webpack.options.externalsType 字段配置
class ExternalsPlugin {
	constructor(type, externals) {
		// Webpack.options.externalsType
		this.type = type;
		// Webpack.options.externals
		this.externals = externals;
	}

	apply(compiler) {
		compiler.hooks.compile.tap("ExternalsPlugin", ({ normalModuleFactory }) => {
			new ExternalModuleFactoryPlugin(this.type, this.externals).apply(
				normalModuleFactory
			);
		});
	}
}

module.exports = ExternalsPlugin;
