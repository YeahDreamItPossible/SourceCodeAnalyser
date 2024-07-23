"use strict";

const ExternalModuleFactoryPlugin = require("./ExternalModuleFactoryPlugin");

// 根据 Webpack.options.externals 和 Webpack.options.externalsType 字段配置
// 外部扩展插件
// 作用:
// 从输出的 bundle 中排除依赖
// 当以 cdn 的方式引入的依赖时 输出的 bundle 不需要额外构建这些依赖
class ExternalsPlugin {
	constructor(type, externals) {
		// 外部依赖的构建类型
		// Webpack.options.externalsType
		this.type = type;
		// 外部依赖
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
