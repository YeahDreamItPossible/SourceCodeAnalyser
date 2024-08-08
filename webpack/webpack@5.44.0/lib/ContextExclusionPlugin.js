"use strict";

// 上下文排除插件
// 作用:
// 在 上下文模块工厂 创建 上下文模块 时 
// 根据 正则 过滤掉满足匹配条件的 资源路径
// 即: 满足 正则匹配条件 的资源路径将不再创建 上下文模块 的实例
class ContextExclusionPlugin {
	constructor(negativeMatcher) {
		// RegExp
		this.negativeMatcher = negativeMatcher;
	}

	apply(compiler) {
		compiler.hooks.contextModuleFactory.tap("ContextExclusionPlugin", cmf => {
			cmf.hooks.contextModuleFiles.tap("ContextExclusionPlugin", files => {
				return files.filter(filePath => !this.negativeMatcher.test(filePath));
			});
		});
	}
}

module.exports = ContextExclusionPlugin;
