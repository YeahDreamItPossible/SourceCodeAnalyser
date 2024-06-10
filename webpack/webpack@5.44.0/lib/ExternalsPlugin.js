"use strict";

const ExternalModuleFactoryPlugin = require("./ExternalModuleFactoryPlugin");

/**
 * 从输出的bundle中排除依赖(以cdn的方式引入的依赖)
 * 根据Webpack.Config.externals和Webpack.Config.externalsType字段配置
 */
class ExternalsPlugin {
	constructor(type, externals) {
		// Webpack.Config.externalsType
		this.type = type;
		// Webpack.Config.externals
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
