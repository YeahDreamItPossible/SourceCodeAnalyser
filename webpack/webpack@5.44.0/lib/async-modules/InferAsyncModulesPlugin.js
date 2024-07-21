"use strict";

const HarmonyImportDependency = require("../dependencies/HarmonyImportDependency");

// 推断异步模块插件
// 作用:
// 在编译过程 将当所有的模块都构建完成时 遍历模块 并标记模块是否是异步的
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
						// 标记 当前模块 是异步的
						moduleGraph.setAsync(module);
						// 遍历 引用当前模块的 模块集合
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
