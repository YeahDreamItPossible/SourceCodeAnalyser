"use strict";

const { getEntryRuntime } = require("./util/runtime");

// TODO:
// 标记入口导出未已使用插件
// 作用:
// 
class FlagEntryExportAsUsedPlugin {
	constructor(nsObjectUsed, explanation) {
		this.nsObjectUsed = nsObjectUsed;
		this.explanation = explanation;
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap(
			"FlagEntryExportAsUsedPlugin",
			compilation => {
				const moduleGraph = compilation.moduleGraph;
				compilation.hooks.seal.tap("FlagEntryExportAsUsedPlugin", () => {
					for (const [
						entryName,
						{ dependencies: deps, options }
					] of compilation.entries) {
						const runtime = getEntryRuntime(compilation, entryName, options);
						for (const dep of deps) {
							const module = moduleGraph.getModule(dep);
							if (module) {
								const exportsInfo = moduleGraph.getExportsInfo(module);
								if (this.nsObjectUsed) {
									exportsInfo.setUsedInUnknownWay(runtime);
								} else {
									exportsInfo.setAllKnownExportsUsed(runtime);
								}
								moduleGraph.addExtraReason(module, this.explanation);
							}
						}
					}
				});
			}
		);
	}
}

module.exports = FlagEntryExportAsUsedPlugin;
