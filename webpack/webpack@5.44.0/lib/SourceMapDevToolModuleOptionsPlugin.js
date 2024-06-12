"use strict";

const JavascriptModulesPlugin = require("./javascript/JavascriptModulesPlugin");

// 根据 Webpack.Config.devtool 字段是否包含 'module' 
// 或者 使用自定义 EvalSourceMapDevToolPlugin 插件时 根据 插件选项
// 来标识 模块是否需要源代码映射
// 即: module.useSourceMap || module.useSimpleSourceMap
class SourceMapDevToolModuleOptionsPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compilation) {
		const options = this.options;
		if (options.module !== false) {
			compilation.hooks.buildModule.tap(
				"SourceMapDevToolModuleOptionsPlugin",
				module => {
					module.useSourceMap = true;
				}
			);
			compilation.hooks.runtimeModule.tap(
				"SourceMapDevToolModuleOptionsPlugin",
				module => {
					module.useSourceMap = true;
				}
			);
		} else {
			compilation.hooks.buildModule.tap(
				"SourceMapDevToolModuleOptionsPlugin",
				module => {
					module.useSimpleSourceMap = true;
				}
			);
			compilation.hooks.runtimeModule.tap(
				"SourceMapDevToolModuleOptionsPlugin",
				module => {
					module.useSimpleSourceMap = true;
				}
			);
		}
		JavascriptModulesPlugin.getCompilationHooks(compilation).useSourceMap.tap(
			"SourceMapDevToolModuleOptionsPlugin",
			() => true
		);
	}
}

module.exports = SourceMapDevToolModuleOptionsPlugin;
