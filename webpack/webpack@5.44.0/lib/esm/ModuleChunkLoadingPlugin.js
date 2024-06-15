"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const ExportWebpackRequireRuntimeModule = require("./ExportWebpackRequireRuntimeModule");
const ModuleChunkLoadingRuntimeModule = require("./ModuleChunkLoadingRuntimeModule");

// 根据 Webpack.options.output.chunkLoading = 'import' 注册该插件
class ModuleChunkLoadingPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap(
			"ModuleChunkLoadingPlugin",
			compilation => {
				const globalChunkLoading = compilation.outputOptions.chunkLoading;
				const isEnabledForChunk = chunk => {
					const options = chunk.getEntryOptions();
					const chunkLoading =
						(options && options.chunkLoading) || globalChunkLoading;
					return chunkLoading === "import";
				};
				const onceForChunkSet = new WeakSet();
				const handler = (chunk, set) => {
					if (onceForChunkSet.has(chunk)) return;
					onceForChunkSet.add(chunk);
					if (!isEnabledForChunk(chunk)) return;
					set.add(RuntimeGlobals.moduleFactoriesAddOnly);
					set.add(RuntimeGlobals.hasOwnProperty);
					compilation.addRuntimeModule(
						chunk,
						new ModuleChunkLoadingRuntimeModule(set)
					);
				};
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.ensureChunkHandlers)
					.tap("ModuleChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.baseURI)
					.tap("ModuleChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.externalInstallChunk)
					.tap("ModuleChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.onChunksLoaded)
					.tap("ModuleChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.externalInstallChunk)
					.tap("ModuleChunkLoadingPlugin", (chunk, set) => {
						if (!isEnabledForChunk(chunk)) return;
						compilation.addRuntimeModule(
							chunk,
							new ExportWebpackRequireRuntimeModule()
						);
					});

				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.ensureChunkHandlers)
					.tap("ModuleChunkLoadingPlugin", (chunk, set) => {
						if (!isEnabledForChunk(chunk)) return;
						set.add(RuntimeGlobals.getChunkScriptFilename);
					});
			}
		);
	}
}

module.exports = ModuleChunkLoadingPlugin;
