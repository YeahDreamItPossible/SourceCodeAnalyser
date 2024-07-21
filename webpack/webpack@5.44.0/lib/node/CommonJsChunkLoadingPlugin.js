"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const StartupChunkDependenciesPlugin = require("../runtime/StartupChunkDependenciesPlugin");

// 根据 Webpack.options.output.enabledChunkLoadingTypes = 'require' 
// 或   Webpack.options.output.enabledChunkLoadingTypes = 'async-node' 时注册插件
// 作用:
// 在 node 环境中 以 同步或者异步的方式 加载非初始化块
class CommonJsChunkLoadingPlugin {
	constructor(options) {
		options = options || {};
		this._asyncChunkLoading = options.asyncChunkLoading;
	}

	apply(compiler) {
		const ChunkLoadingRuntimeModule = this._asyncChunkLoading
			? require("./ReadFileChunkLoadingRuntimeModule")
			: require("./RequireChunkLoadingRuntimeModule");
		const chunkLoadingValue = this._asyncChunkLoading
			? "async-node"
			: "require";
		new StartupChunkDependenciesPlugin({
			chunkLoading: chunkLoadingValue,
			asyncChunkLoading: this._asyncChunkLoading
		}).apply(compiler);
		compiler.hooks.thisCompilation.tap(
			"CommonJsChunkLoadingPlugin",
			compilation => {
				const globalChunkLoading = compilation.outputOptions.chunkLoading;
				const isEnabledForChunk = chunk => {
					const options = chunk.getEntryOptions();
					const chunkLoading =
						options && options.chunkLoading !== undefined
							? options.chunkLoading
							: globalChunkLoading;
					return chunkLoading === chunkLoadingValue;
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
						new ChunkLoadingRuntimeModule(set)
					);
				};

				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.ensureChunkHandlers)
					.tap("CommonJsChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.hmrDownloadUpdateHandlers)
					.tap("CommonJsChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.hmrDownloadManifest)
					.tap("CommonJsChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.baseURI)
					.tap("CommonJsChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.externalInstallChunk)
					.tap("CommonJsChunkLoadingPlugin", handler);
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.onChunksLoaded)
					.tap("CommonJsChunkLoadingPlugin", handler);

				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.ensureChunkHandlers)
					.tap("CommonJsChunkLoadingPlugin", (chunk, set) => {
						if (!isEnabledForChunk(chunk)) return;
						set.add(RuntimeGlobals.getChunkScriptFilename);
					});
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.hmrDownloadUpdateHandlers)
					.tap("CommonJsChunkLoadingPlugin", (chunk, set) => {
						if (!isEnabledForChunk(chunk)) return;
						set.add(RuntimeGlobals.getChunkUpdateScriptFilename);
						set.add(RuntimeGlobals.moduleCache);
						set.add(RuntimeGlobals.hmrModuleData);
						set.add(RuntimeGlobals.moduleFactoriesAddOnly);
					});
				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.hmrDownloadManifest)
					.tap("CommonJsChunkLoadingPlugin", (chunk, set) => {
						if (!isEnabledForChunk(chunk)) return;
						set.add(RuntimeGlobals.getUpdateManifestFilename);
					});
			}
		);
	}
}

module.exports = CommonJsChunkLoadingPlugin;
