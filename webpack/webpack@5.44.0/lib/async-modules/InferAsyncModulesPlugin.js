"use strict";

const HarmonyImportDependency = require("../dependencies/HarmonyImportDependency");

// 异步模块插件
class InferAsyncModulesPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("InferAsyncModulesPlugin", compilation => {
			const { moduleGraph } = compilation;
			compilation.hooks.finishModules.tap(
				"InferAsyncModulesPlugin",
				modules => {
					// Set<Module>
					const queue = new Set();
					for (const module of modules) {
						if (module.buildMeta && module.buildMeta.async) {
							queue.add(module);
						}
					}
					for (const module of queue) {
						moduleGraph.setAsync(module);
						for (const [
							originModule,
							connections
						] of moduleGraph.getIncomingConnectionsByOriginModule(module)) {
							if (
								connections.some(
									c =>
										c.dependency instanceof HarmonyImportDependency &&
										c.isTargetActive(undefined)
								)
							) {
								queue.add(originModule);
							}
						}
					}
				}
			);
		});
	}
}

module.exports = InferAsyncModulesPlugin;
