"use strict";

// TODO:
// 根据 Webpack.options.cache.buildDependencies 注册该插件
// 作用: 
// 缓存构建依赖 ??
class AddBuildDependenciesPlugin {
	constructor(buildDependencies) {
		this.buildDependencies = new Set(buildDependencies);
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"AddBuildDependenciesPlugin",
			compilation => {
				compilation.buildDependencies.addAll(this.buildDependencies);
			}
		);
	}
}

module.exports = AddBuildDependenciesPlugin;
