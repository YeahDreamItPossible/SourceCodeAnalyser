"use strict";

const NormalModule = require("./NormalModule");

// 加载器目标插件
// 作用:
// 设置 loaderContext.target
// 有的 loader 需要从配置中读取一些 context 信息(保持对旧 loaders 的兼容)
// 目前版本的loader 从 loader.options 传入
class LoaderTargetPlugin {
	constructor(target) {
		this.target = target;
	}

	apply(compiler) {
		compiler.hooks.compilation.tap("LoaderTargetPlugin", compilation => {
			NormalModule.getCompilationHooks(compilation).loader.tap(
				"LoaderTargetPlugin",
				loaderContext => {
					loaderContext.target = this.target;
				}
			);
		});
	}
}

module.exports = LoaderTargetPlugin;
