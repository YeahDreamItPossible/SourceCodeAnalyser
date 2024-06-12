"use strict";

const OptionsApply = require("./OptionsApply");

const AssetModulesPlugin = require("./asset/AssetModulesPlugin");
const JavascriptModulesPlugin = require("./javascript/JavascriptModulesPlugin");
const JsonModulesPlugin = require("./json/JsonModulesPlugin");

const ChunkPrefetchPreloadPlugin = require("./prefetch/ChunkPrefetchPreloadPlugin");

const EntryOptionPlugin = require("./EntryOptionPlugin");
const RecordIdsPlugin = require("./RecordIdsPlugin");

const RuntimePlugin = require("./RuntimePlugin");

const APIPlugin = require("./APIPlugin");
const CompatibilityPlugin = require("./CompatibilityPlugin");
const ConstPlugin = require("./ConstPlugin");
const ExportsInfoApiPlugin = require("./ExportsInfoApiPlugin");
const WebpackIsIncludedPlugin = require("./WebpackIsIncludedPlugin");

const TemplatedPathPlugin = require("./TemplatedPathPlugin");
const UseStrictPlugin = require("./UseStrictPlugin");
const WarnCaseSensitiveModulesPlugin = require("./WarnCaseSensitiveModulesPlugin");

const DataUriPlugin = require("./schemes/DataUriPlugin");
const FileUriPlugin = require("./schemes/FileUriPlugin");

const ResolverCachePlugin = require("./cache/ResolverCachePlugin");

const CommonJsPlugin = require("./dependencies/CommonJsPlugin");
const HarmonyModulesPlugin = require("./dependencies/HarmonyModulesPlugin");
const ImportMetaPlugin = require("./dependencies/ImportMetaPlugin");
const ImportPlugin = require("./dependencies/ImportPlugin");
const LoaderPlugin = require("./dependencies/LoaderPlugin");
const RequireContextPlugin = require("./dependencies/RequireContextPlugin");
const RequireEnsurePlugin = require("./dependencies/RequireEnsurePlugin");
const RequireIncludePlugin = require("./dependencies/RequireIncludePlugin");
const SystemPlugin = require("./dependencies/SystemPlugin");
const URLPlugin = require("./dependencies/URLPlugin");
const WorkerPlugin = require("./dependencies/WorkerPlugin");

const InferAsyncModulesPlugin = require("./async-modules/InferAsyncModulesPlugin");

const JavascriptMetaInfoPlugin = require("./JavascriptMetaInfoPlugin");
const DefaultStatsFactoryPlugin = require("./stats/DefaultStatsFactoryPlugin");
const DefaultStatsPresetPlugin = require("./stats/DefaultStatsPresetPlugin");
const DefaultStatsPrinterPlugin = require("./stats/DefaultStatsPrinterPlugin");

const { cleverMerge } = require("./util/cleverMerge");

// 使用 Webpack.plugins
class WebpackOptionsApply extends OptionsApply {
	constructor() {
		super();
	}

	process(options, compiler) {
		compiler.outputPath = options.output.path;
		compiler.recordsInputPath = options.recordsInputPath || null;
		compiler.recordsOutputPath = options.recordsOutputPath || null;
		compiler.name = options.name;


		// 排除依赖(以cdn方式引入的)
		// Webpack.Config.externals
		if (options.externals) {
			const ExternalsPlugin = require("./ExternalsPlugin");
			new ExternalsPlugin(options.externalsType, options.externals).apply(
				compiler
			);
		}

		// externals presets
		// 为特定的 target 启用 externals 的 preset
		// Webpack.Config.externalsPresets.node
		if (options.externalsPresets.node) {
			const NodeTargetPlugin = require("./node/NodeTargetPlugin");
			new NodeTargetPlugin().apply(compiler);
		}
		// Webpack.Config.externalsPresets.electronMain
		if (options.externalsPresets.electronMain) {
			const ElectronTargetPlugin = require("./electron/ElectronTargetPlugin");
			new ElectronTargetPlugin("main").apply(compiler);
		}
		// Webpack.Config.externalsPresets.electronPreload
		if (options.externalsPresets.electronPreload) {
			const ElectronTargetPlugin = require("./electron/ElectronTargetPlugin");
			new ElectronTargetPlugin("preload").apply(compiler);
		}
		// Webpack.Config.externalsPresets.electronRenderer
		if (options.externalsPresets.electronRenderer) {
			//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
			const ElectronTargetPlugin = require("./electron/ElectronTargetPlugin");
			new ElectronTargetPlugin("renderer").apply(compiler);
		}
		if (
			options.externalsPresets.electron &&
			!options.externalsPresets.electronMain &&
			!options.externalsPresets.electronPreload &&
			!options.externalsPresets.electronRenderer
		) {
			const ElectronTargetPlugin = require("./electron/ElectronTargetPlugin");
			new ElectronTargetPlugin().apply(compiler);
		}
		// Webpack.Config.externalsPresets.nwjs
		if (options.externalsPresets.nwjs) {
			const ExternalsPlugin = require("./ExternalsPlugin");
			new ExternalsPlugin("node-commonjs", "nw.gui").apply(compiler);
		}
		// Webpack.Config.externalsPresets.webAsync
		if (options.externalsPresets.webAsync) {
			const ExternalsPlugin = require("./ExternalsPlugin");
			new ExternalsPlugin("import", /^(https?:\/\/|std:)/).apply(compiler);
		} 
		// Webpack.Config.externalsPresets.web
		else if (options.externalsPresets.web) {
			//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
			const ExternalsPlugin = require("./ExternalsPlugin");
			new ExternalsPlugin("module", /^(https?:\/\/|std:)/).apply(compiler);
		}

		//
		new ChunkPrefetchPreloadPlugin().apply(compiler);

		// 非运行时Chunk 的格式
		// Webpack.Config.output.chunkFormat
		if (typeof options.output.chunkFormat === "string") {
			switch (options.output.chunkFormat) {
				case "array-push": {
					const ArrayPushCallbackChunkFormatPlugin = require("./javascript/ArrayPushCallbackChunkFormatPlugin");
					new ArrayPushCallbackChunkFormatPlugin().apply(compiler);
					break;
				}
				case "commonjs": {
					const CommonJsChunkFormatPlugin = require("./javascript/CommonJsChunkFormatPlugin");
					new CommonJsChunkFormatPlugin().apply(compiler);
					break;
				}
				case "module": {
					const ModuleChunkFormatPlugin = require("./esm/ModuleChunkFormatPlugin");
					new ModuleChunkFormatPlugin().apply(compiler);
					break;
				}
				default:
					throw new Error(
						"Unsupported chunk format '" + options.output.chunkFormat + "'."
					);
			}
		}

		// Chunk 加载类型
		// Webpack.Config.output.enabledChunkLoadingTypes
		if (options.output.enabledChunkLoadingTypes.length > 0) {
			for (const type of options.output.enabledChunkLoadingTypes) {
				const EnableChunkLoadingPlugin = require("./javascript/EnableChunkLoadingPlugin");
				new EnableChunkLoadingPlugin(type).apply(compiler);
			}
		}

		// Webpack.Config.output.enabledWasmLoadingTypes
		if (options.output.enabledWasmLoadingTypes.length > 0) {
			for (const type of options.output.enabledWasmLoadingTypes) {
				const EnableWasmLoadingPlugin = require("./wasm/EnableWasmLoadingPlugin");
				new EnableWasmLoadingPlugin(type).apply(compiler);
			}
		}

		// Webpack.Config.output.enabledLibraryTypes
		if (options.output.enabledLibraryTypes.length > 0) {
			for (const type of options.output.enabledLibraryTypes) {
				const EnableLibraryPlugin = require("./library/EnableLibraryPlugin");
				new EnableLibraryPlugin(type).apply(compiler);
			}
		}

		// Webpack.Config.output.pathinfo
		// 告知 webpack 在 bundle 中引入「所包含模块信息」的相关注释
		if (options.output.pathinfo) {
			const ModuleInfoHeaderPlugin = require("./ModuleInfoHeaderPlugin");
			new ModuleInfoHeaderPlugin(options.output.pathinfo !== true).apply(
				compiler
			);
		}

		// Webpack.Config.output.clean
		if (options.output.clean) {
			const CleanPlugin = require("./CleanPlugin");
			new CleanPlugin(
				options.output.clean === true ? {} : options.output.clean
			).apply(compiler);
		}

		// Webpack.Config.devtool
		// [inline-|hidden-|eval-][nosources-][cheap-[module-]]source-map || eval
		// Wepack.Config.devtool 字段值 只要包含 source-map 表示要生成 source-map JSON文件
		// module cheap nosources 是用来对 source-map 文件内容进行筛选
		// nosources 表示 source-map 文件不需要包含 sourceContent 字段
		// cheap 表示 source-map 文件 mappings 字段 是否需要列映射
		// module 表示 source-map 文件 是否为 loaders 添加 source map
		// inline hidden eval 表示source-map 文件位置
		// eval 表示将 source-map 文件追加到每个模块后面
		// inline 表示将 source-map 文件追加到每个输出文件后面
		// hidden 表示将 source-map 文件单独放到映射文件中
		if (options.devtool) {
			if (options.devtool.includes("source-map")) {
				const hidden = options.devtool.includes("hidden");
				const inline = options.devtool.includes("inline");
				const evalWrapped = options.devtool.includes("eval");
				// 当 devtool 值 包含 cheap 时 表示不需要 列映射 默认需要
				const cheap = options.devtool.includes("cheap");
				// 
				const moduleMaps = options.devtool.includes("module");
				const noSources = options.devtool.includes("nosources");
				const Plugin = evalWrapped
					? require("./EvalSourceMapDevToolPlugin")
					: require("./SourceMapDevToolPlugin");
				new Plugin({
					// 定义生成的 SourceMap 的名称(不设置将默认置为 inlined)
					filename: inline ? null : options.output.sourceMapFilename,
					// 开发工具模块文件名模板
					moduleFilenameTemplate: options.output.devtoolModuleFilenameTemplate,
					// 回退的开发工具模块文件名模板
					fallbackModuleFilenameTemplate: options.output.devtoolFallbackModuleFilenameTemplate,
					// 在原始资源后追加给定值。通常是 #sourceMappingURL 注释。
					append: hidden ? false : undefined,
					// 表示是否为 loaders 添加 source map
					module: moduleMaps ? true : cheap ? false : true,
					// 表示是否使用列映射(column mapping)
					columns: cheap ? false : true,
					// 防止源文件的内容被包含在 source map 中
					noSources: noSources,
					// 
					namespace: options.output.devtoolNamespace
				}).apply(compiler);
			} else if (options.devtool.includes("eval")) {
				const EvalDevToolModulePlugin = require("./EvalDevToolModulePlugin");
				new EvalDevToolModulePlugin({
					moduleFilenameTemplate: options.output.devtoolModuleFilenameTemplate,
					namespace: options.output.devtoolNamespace
				}).apply(compiler);
			}
		}

		// 内置资源处理
		new JavascriptModulesPlugin().apply(compiler);
		new JsonModulesPlugin().apply(compiler);
		new AssetModulesPlugin().apply(compiler);

		if (!options.experiments.outputModule) {
			if (options.output.module) {
				throw new Error(
					"'output.module: true' is only allowed when 'experiments.outputModule' is enabled"
				);
			}
			if (options.output.enabledLibraryTypes.includes("module")) {
				throw new Error(
					"library type \"module\" is only allowed when 'experiments.outputModule' is enabled"
				);
			}
			if (options.externalsType === "module") {
				throw new Error(
					"'externalsType: \"module\"' is only allowed when 'experiments.outputModule' is enabled"
				);
			}
		}

		// Webpack.Config.experiments
		if (options.experiments.syncWebAssembly) {
			const WebAssemblyModulesPlugin = require("./wasm-sync/WebAssemblyModulesPlugin");
			new WebAssemblyModulesPlugin({
				mangleImports: options.optimization.mangleWasmImports
			}).apply(compiler);
		}

		if (options.experiments.asyncWebAssembly) {
			const AsyncWebAssemblyModulesPlugin = require("./wasm-async/AsyncWebAssemblyModulesPlugin");
			new AsyncWebAssemblyModulesPlugin({
				mangleImports: options.optimization.mangleWasmImports
			}).apply(compiler);
		}

		if (options.experiments.lazyCompilation) {
			const LazyCompilationPlugin = require("./hmr/LazyCompilationPlugin");
			const lazyOptions =
				typeof options.experiments.lazyCompilation === "object"
					? options.experiments.lazyCompilation
					: null;
			new LazyCompilationPlugin({
				backend:
					(lazyOptions && lazyOptions.backend) ||
					require("./hmr/lazyCompilationBackend"),
				client:
					(lazyOptions && lazyOptions.client) ||
					require.resolve(
						`../hot/lazy-compilation-${
							options.externalsPresets.node ? "node" : "web"
						}.js`
					),
				entries: !lazyOptions || lazyOptions.entries !== false,
				imports: !lazyOptions || lazyOptions.imports !== false,
				test: (lazyOptions && lazyOptions.test) || undefined
			}).apply(compiler);
		}

		// 注册入口插件
		new EntryOptionPlugin().apply(compiler);
		compiler.hooks.entryOption.call(options.context, options.entry);

		// 运行时插件
		new RuntimePlugin().apply(compiler);
		// 异步模块插件
		new InferAsyncModulesPlugin().apply(compiler);

		new DataUriPlugin().apply(compiler);
		new FileUriPlugin().apply(compiler);

		new CompatibilityPlugin().apply(compiler);
		// ES模块
		new HarmonyModulesPlugin({
			topLevelAwait: options.experiments.topLevelAwait
		}).apply(compiler);
		// AMD模块
		if (options.amd !== false) {
			const AMDPlugin = require("./dependencies/AMDPlugin");
			const RequireJsStuffPlugin = require("./RequireJsStuffPlugin");
			new AMDPlugin(options.amd || {}).apply(compiler);
			new RequireJsStuffPlugin().apply(compiler);
		}
		// CommonJS 模块
		new CommonJsPlugin().apply(compiler);
		//
		new LoaderPlugin({
			enableExecuteModule: options.experiments.executeModule
		}).apply(compiler);
		//
		if (options.node !== false) {
			const NodeStuffPlugin = require("./NodeStuffPlugin");
			new NodeStuffPlugin(options.node).apply(compiler);
		}
		//
		new APIPlugin().apply(compiler);
		//
		new ExportsInfoApiPlugin().apply(compiler);
		//
		new WebpackIsIncludedPlugin().apply(compiler);
		//
		new ConstPlugin().apply(compiler);
		// 使用严格模式
		new UseStrictPlugin().apply(compiler);
		// 
		new RequireIncludePlugin().apply(compiler);
		// 
		new RequireEnsurePlugin().apply(compiler);
		// 
		new RequireContextPlugin().apply(compiler);
		// 
		new ImportPlugin().apply(compiler);
		//
		new SystemPlugin().apply(compiler);
		// 
		new ImportMetaPlugin().apply(compiler);
		new URLPlugin().apply(compiler);
		new WorkerPlugin(
			options.output.workerChunkLoading,
			options.output.workerWasmLoading,
			options.output.module
		).apply(compiler);

		// Webpack.Config.stats
		new DefaultStatsFactoryPlugin().apply(compiler);
		new DefaultStatsPresetPlugin().apply(compiler);
		new DefaultStatsPrinterPlugin().apply(compiler);

		new JavascriptMetaInfoPlugin().apply(compiler);

		// Webpack.Config.mode
		if (typeof options.mode !== "string") {
			const WarnNoModeSetPlugin = require("./WarnNoModeSetPlugin");
			new WarnNoModeSetPlugin().apply(compiler);
		}

		// 
		const EnsureChunkConditionsPlugin = require("./optimize/EnsureChunkConditionsPlugin");
		new EnsureChunkConditionsPlugin().apply(compiler);
		// Webpack.Config.optimization.removeAvailableModules
		if (options.optimization.removeAvailableModules) {
			const RemoveParentModulesPlugin = require("./optimize/RemoveParentModulesPlugin");
			new RemoveParentModulesPlugin().apply(compiler);
		}
		// Webpack.Config.optimization.removeEmptyChunks
		// 移除空块
		if (options.optimization.removeEmptyChunks) {
			const RemoveEmptyChunksPlugin = require("./optimize/RemoveEmptyChunksPlugin");
			new RemoveEmptyChunksPlugin().apply(compiler);
		}
		// Webpack.Config.optimization.mergeDuplicateChunks
		// 合并重复块
		if (options.optimization.mergeDuplicateChunks) {
			const MergeDuplicateChunksPlugin = require("./optimize/MergeDuplicateChunksPlugin");
			new MergeDuplicateChunksPlugin().apply(compiler);
		}
		// Webpack.Config.optimization.flagIncludedChunks
		// 
		if (options.optimization.flagIncludedChunks) {
			const FlagIncludedChunksPlugin = require("./optimize/FlagIncludedChunksPlugin");
			new FlagIncludedChunksPlugin().apply(compiler);
		}
		// Webpack.Config.optimization.sideEffects
		// 告诉 webpack 去辨识 package.json 中的 sideEffects 标记或规则，
		// 以跳过那些当导出不被使用且被标记为不包含副作用的模块
		if (options.optimization.sideEffects) {
			const SideEffectsFlagPlugin = require("./optimize/SideEffectsFlagPlugin");
			new SideEffectsFlagPlugin(
				options.optimization.sideEffects === true
			).apply(compiler);
		}
		// Webpack.Config.optimization.providedExports
		// 告知 webpack 去确定那些由模块提供的导出内容，为 export * from ... 生成更多高效的代码。
		if (options.optimization.providedExports) {
			const FlagDependencyExportsPlugin = require("./FlagDependencyExportsPlugin");
			new FlagDependencyExportsPlugin().apply(compiler);
		}
		// Webpack.Config.optimization.usedExports
		// 告诉 webpack 去决定每个模块的到处内容是否被使用
		// 这首先取决于 optimization.providedExports 选项是否被启用
		if (options.optimization.usedExports) {
			const FlagDependencyUsagePlugin = require("./FlagDependencyUsagePlugin");
			new FlagDependencyUsagePlugin(
				options.optimization.usedExports === "global"
			).apply(compiler);
		}
		// 根据 Wepback.Config.optimaztion.innerGraph 注册该插件
		// 告诉 webpack 是否对未使用的导出内容实施内部图形分析
		if (options.optimization.innerGraph) {
			const InnerGraphPlugin = require("./optimize/InnerGraphPlugin");
			new InnerGraphPlugin().apply(compiler);
		}
		if (options.optimization.mangleExports) {
			const MangleExportsPlugin = require("./optimize/MangleExportsPlugin");
			new MangleExportsPlugin(
				options.optimization.mangleExports !== "size"
			).apply(compiler);
		}
		if (options.optimization.concatenateModules) {
			const ModuleConcatenationPlugin = require("./optimize/ModuleConcatenationPlugin");
			new ModuleConcatenationPlugin().apply(compiler);
		}
		if (options.optimization.splitChunks) {
			const SplitChunksPlugin = require("./optimize/SplitChunksPlugin");
			new SplitChunksPlugin(options.optimization.splitChunks).apply(compiler);
		}
		if (options.optimization.runtimeChunk) {
			const RuntimeChunkPlugin = require("./optimize/RuntimeChunkPlugin");
			new RuntimeChunkPlugin(options.optimization.runtimeChunk).apply(compiler);
		}
		if (!options.optimization.emitOnErrors) {
			const NoEmitOnErrorsPlugin = require("./NoEmitOnErrorsPlugin");
			new NoEmitOnErrorsPlugin().apply(compiler);
		}
		if (options.optimization.realContentHash) {
			const RealContentHashPlugin = require("./optimize/RealContentHashPlugin");
			new RealContentHashPlugin({
				hashFunction: options.output.hashFunction,
				hashDigest: options.output.hashDigest
			}).apply(compiler);
		}
		if (options.optimization.checkWasmTypes) {
			const WasmFinalizeExportsPlugin = require("./wasm-sync/WasmFinalizeExportsPlugin");
			new WasmFinalizeExportsPlugin().apply(compiler);
		}
		const moduleIds = options.optimization.moduleIds;
		if (moduleIds) {
			switch (moduleIds) {
				case "natural": {
					const NaturalModuleIdsPlugin = require("./ids/NaturalModuleIdsPlugin");
					new NaturalModuleIdsPlugin().apply(compiler);
					break;
				}
				case "named": {
					const NamedModuleIdsPlugin = require("./ids/NamedModuleIdsPlugin");
					new NamedModuleIdsPlugin().apply(compiler);
					break;
				}
				case "hashed": {
					const WarnDeprecatedOptionPlugin = require("./WarnDeprecatedOptionPlugin");
					const HashedModuleIdsPlugin = require("./ids/HashedModuleIdsPlugin");
					new WarnDeprecatedOptionPlugin(
						"optimization.moduleIds",
						"hashed",
						"deterministic"
					).apply(compiler);
					new HashedModuleIdsPlugin().apply(compiler);
					break;
				}
				case "deterministic": {
					const DeterministicModuleIdsPlugin = require("./ids/DeterministicModuleIdsPlugin");
					new DeterministicModuleIdsPlugin().apply(compiler);
					break;
				}
				case "size": {
					const OccurrenceModuleIdsPlugin = require("./ids/OccurrenceModuleIdsPlugin");
					new OccurrenceModuleIdsPlugin({
						prioritiseInitial: true
					}).apply(compiler);
					break;
				}
				default:
					throw new Error(
						`webpack bug: moduleIds: ${moduleIds} is not implemented`
					);
			}
		}
		const chunkIds = options.optimization.chunkIds;
		if (chunkIds) {
			switch (chunkIds) {
				case "natural": {
					const NaturalChunkIdsPlugin = require("./ids/NaturalChunkIdsPlugin");
					new NaturalChunkIdsPlugin().apply(compiler);
					break;
				}
				case "named": {
					const NamedChunkIdsPlugin = require("./ids/NamedChunkIdsPlugin");
					new NamedChunkIdsPlugin().apply(compiler);
					break;
				}
				case "deterministic": {
					const DeterministicChunkIdsPlugin = require("./ids/DeterministicChunkIdsPlugin");
					new DeterministicChunkIdsPlugin().apply(compiler);
					break;
				}
				case "size": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const OccurrenceChunkIdsPlugin = require("./ids/OccurrenceChunkIdsPlugin");
					new OccurrenceChunkIdsPlugin({
						prioritiseInitial: true
					}).apply(compiler);
					break;
				}
				case "total-size": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const OccurrenceChunkIdsPlugin = require("./ids/OccurrenceChunkIdsPlugin");
					new OccurrenceChunkIdsPlugin({
						prioritiseInitial: false
					}).apply(compiler);
					break;
				}
				default:
					throw new Error(
						`webpack bug: chunkIds: ${chunkIds} is not implemented`
					);
			}
		}
		if (options.optimization.nodeEnv) {
			const DefinePlugin = require("./DefinePlugin");
			new DefinePlugin({
				"process.env.NODE_ENV": JSON.stringify(options.optimization.nodeEnv)
			}).apply(compiler);
		}
		if (options.optimization.minimize) {
			for (const minimizer of options.optimization.minimizer) {
				if (typeof minimizer === "function") {
					minimizer.call(compiler, compiler);
				} else if (minimizer !== "...") {
					minimizer.apply(compiler);
				}
			}
		}

		if (options.performance) {
			const SizeLimitsPlugin = require("./performance/SizeLimitsPlugin");
			new SizeLimitsPlugin(options.performance).apply(compiler);
		}

		new TemplatedPathPlugin().apply(compiler);

		new RecordIdsPlugin({
			portableIds: options.optimization.portableRecords
		}).apply(compiler);

		// 当 Module.identifier 有重复时 抛出错误
		new WarnCaseSensitiveModulesPlugin().apply(compiler);

		// 
		const AddManagedPathsPlugin = require("./cache/AddManagedPathsPlugin");
		new AddManagedPathsPlugin(
			options.snapshot.managedPaths,
			options.snapshot.immutablePaths
		).apply(compiler);

		if (options.cache && typeof options.cache === "object") {
			const cacheOptions = options.cache;
			switch (cacheOptions.type) {
				case "memory": {
					if (isFinite(cacheOptions.maxGenerations)) {
						//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
						const MemoryWithGcCachePlugin = require("./cache/MemoryWithGcCachePlugin");
						new MemoryWithGcCachePlugin({
							maxGenerations: cacheOptions.maxGenerations
						}).apply(compiler);
					} else {
						//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
						const MemoryCachePlugin = require("./cache/MemoryCachePlugin");
						new MemoryCachePlugin().apply(compiler);
					}
					break;
				}
				case "filesystem": {
					const AddBuildDependenciesPlugin = require("./cache/AddBuildDependenciesPlugin");
					for (const key in cacheOptions.buildDependencies) {
						const list = cacheOptions.buildDependencies[key];
						new AddBuildDependenciesPlugin(list).apply(compiler);
					}
					if (!isFinite(cacheOptions.maxMemoryGenerations)) {
						//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
						const MemoryCachePlugin = require("./cache/MemoryCachePlugin");
						new MemoryCachePlugin().apply(compiler);
					} else if (cacheOptions.maxMemoryGenerations !== 0) {
						//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
						const MemoryWithGcCachePlugin = require("./cache/MemoryWithGcCachePlugin");
						new MemoryWithGcCachePlugin({
							maxGenerations: cacheOptions.maxMemoryGenerations
						}).apply(compiler);
					}
					switch (cacheOptions.store) {
						case "pack": {
							const IdleFileCachePlugin = require("./cache/IdleFileCachePlugin");
							const PackFileCacheStrategy = require("./cache/PackFileCacheStrategy");
							new IdleFileCachePlugin(
								new PackFileCacheStrategy({
									compiler,
									fs: compiler.intermediateFileSystem,
									context: options.context,
									cacheLocation: cacheOptions.cacheLocation,
									version: cacheOptions.version,
									logger: compiler.getInfrastructureLogger(
										"webpack.cache.PackFileCacheStrategy"
									),
									snapshot: options.snapshot,
									maxAge: cacheOptions.maxAge,
									profile: cacheOptions.profile,
									allowCollectingMemory: cacheOptions.allowCollectingMemory,
									compression: cacheOptions.compression
								}),
								cacheOptions.idleTimeout,
								cacheOptions.idleTimeoutForInitialStore,
								cacheOptions.idleTimeoutAfterLargeChanges
							).apply(compiler);
							break;
						}
						default:
							throw new Error("Unhandled value for cache.store");
					}
					break;
				}
				default:
					// @ts-expect-error Property 'type' does not exist on type 'never'. ts(2339)
					throw new Error(`Unknown cache type ${cacheOptions.type}`);
			}
		}
		new ResolverCachePlugin().apply(compiler);

		// options.ignoreWarnings 用户筛选warnings的条件数组
		if (options.ignoreWarnings && options.ignoreWarnings.length > 0) {
			const IgnoreWarningsPlugin = require("./IgnoreWarningsPlugin");
			new IgnoreWarningsPlugin(options.ignoreWarnings).apply(compiler);
		}

		compiler.hooks.afterPlugins.call(compiler);
		if (!compiler.inputFileSystem) {
			throw new Error("No input filesystem provided");
		}

		// 内置的路径解析器
		// normal: 通过绝对或相对路径解析模块
		compiler.resolverFactory.hooks.resolveOptions
			.for("normal")
			.tap("WebpackOptionsApply", resolveOptions => {
				resolveOptions = cleverMerge(options.resolve, resolveOptions);
				resolveOptions.fileSystem = compiler.inputFileSystem;
				return resolveOptions;
			});
		// context: 在给定的上下文中解析模块
		compiler.resolverFactory.hooks.resolveOptions
			.for("context")
			.tap("WebpackOptionsApply", resolveOptions => {
				resolveOptions = cleverMerge(options.resolve, resolveOptions);
				resolveOptions.fileSystem = compiler.inputFileSystem;
				resolveOptions.resolveToContext = true;
				return resolveOptions;
			});
		// loader: 解析 webpack loader
		compiler.resolverFactory.hooks.resolveOptions
			.for("loader")
			.tap("WebpackOptionsApply", resolveOptions => {
				resolveOptions = cleverMerge(options.resolveLoader, resolveOptions);
				resolveOptions.fileSystem = compiler.inputFileSystem;
				return resolveOptions;
			});
		compiler.hooks.afterResolvers.call(compiler);
		return options;
	}
}

module.exports = WebpackOptionsApply;
