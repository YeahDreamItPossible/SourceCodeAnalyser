"use strict";

const { getEntryRuntime, mergeRuntimeOwned } = require("./util/runtime");

// TODO:
// 标记所有模块为已使用插件
// 作用:
// 
// 与 DllPlugin 相关
// 当 DllPlugin.options.entryOnly !== true 时
class FlagAllModulesAsUsedPlugin {
	constructor(explanation) {
		this.explanation = explanation;
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"FlagAllModulesAsUsedPlugin",
			compilation => {
				const moduleGraph = compilation.moduleGraph;
				compilation.hooks.optimizeDependencies.tap(
					"FlagAllModulesAsUsedPlugin",
					modules => {
						let runtime = undefined;
						for (const [name, { options }] of compilation.entries) {
							runtime = mergeRuntimeOwned(
								runtime,
								getEntryRuntime(compilation, name, options)
							);
						}
						for (const module of modules) {
							const exportsInfo = moduleGraph.getExportsInfo(module);
							exportsInfo.setUsedInUnknownWay(runtime);
							moduleGraph.addExtraReason(module, this.explanation);
							if (module.factoryMeta === undefined) {
								module.factoryMeta = {};
							}
							module.factoryMeta.sideEffectFree = false;
						}
					}
				);
			}
		);
	}
}

module.exports = FlagAllModulesAsUsedPlugin;
