"use strict";

// 上下文排除插件
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
