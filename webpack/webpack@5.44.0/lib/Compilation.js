"use strict";

const asyncLib = require("neo-async");
const {
	HookMap,
	SyncHook,
	SyncBailHook,
	SyncWaterfallHook,
	AsyncSeriesHook,
	AsyncSeriesBailHook,
	AsyncParallelHook
} = require("tapable");
const util = require("util");
const { CachedSource } = require("webpack-sources");
const { MultiItemCache } = require("./CacheFacade");
const Chunk = require("./Chunk");
const ChunkGraph = require("./ChunkGraph");
const ChunkGroup = require("./ChunkGroup");
const ChunkRenderError = require("./ChunkRenderError");
const ChunkTemplate = require("./ChunkTemplate");
const CodeGenerationError = require("./CodeGenerationError");
const CodeGenerationResults = require("./CodeGenerationResults");
const DependencyTemplates = require("./DependencyTemplates");
const Entrypoint = require("./Entrypoint");
const ErrorHelpers = require("./ErrorHelpers");
const FileSystemInfo = require("./FileSystemInfo");
const {
	connectChunkGroupAndChunk,
	connectChunkGroupParentAndChild
} = require("./GraphHelpers");
const {
	makeWebpackError,
	tryRunOrWebpackError
} = require("./HookWebpackError");
const MainTemplate = require("./MainTemplate");
const Module = require("./Module");
const ModuleDependencyError = require("./ModuleDependencyError");
const ModuleDependencyWarning = require("./ModuleDependencyWarning");
const ModuleGraph = require("./ModuleGraph");
const ModuleNotFoundError = require("./ModuleNotFoundError");
const ModuleProfile = require("./ModuleProfile");
const ModuleRestoreError = require("./ModuleRestoreError");
const ModuleStoreError = require("./ModuleStoreError");
const ModuleTemplate = require("./ModuleTemplate");
const RuntimeGlobals = require("./RuntimeGlobals");
const RuntimeTemplate = require("./RuntimeTemplate");
const Stats = require("./Stats");
const WebpackError = require("./WebpackError");
const buildChunkGraph = require("./buildChunkGraph");
const BuildCycleError = require("./errors/BuildCycleError");
const { Logger, LogType } = require("./logging/Logger");
const StatsFactory = require("./stats/StatsFactory");
const StatsPrinter = require("./stats/StatsPrinter");
const { equals: arrayEquals } = require("./util/ArrayHelpers");
const AsyncQueue = require("./util/AsyncQueue");
const LazySet = require("./util/LazySet");
const { provide } = require("./util/MapHelpers");
const { cachedCleverMerge } = require("./util/cleverMerge");
const {
	compareLocations,
	concatComparators,
	compareSelect,
	compareIds,
	compareStringsNumeric,
	compareModulesByIdentifier
} = require("./util/comparators");
const createHash = require("./util/createHash");
const {
	arrayToSetDeprecation,
	soonFrozenObjectDeprecation,
	createFakeHook
} = require("./util/deprecation");
const processAsyncTree = require("./util/processAsyncTree");
const { getRuntimeKey } = require("./util/runtime");
const { isSourceEqual } = require("./util/source");

/** @typedef {import("../declarations/WebpackOptions").EntryDescriptionNormalized} EntryDescription */
/** @typedef {import("../declarations/WebpackOptions").OutputNormalized} OutputOptions */
/** @typedef {import("../declarations/WebpackOptions").StatsOptions} StatsOptions */
/** @typedef {import("../declarations/WebpackOptions").WebpackPluginFunction} WebpackPluginFunction */
/** @typedef {import("../declarations/WebpackOptions").WebpackPluginInstance} WebpackPluginInstance */
/** @typedef {import("./AsyncDependenciesBlock")} AsyncDependenciesBlock */
/** @typedef {import("./Cache")} Cache */
/** @typedef {import("./CacheFacade")} CacheFacade */
/** @typedef {import("./ChunkGroup").ChunkGroupOptions} ChunkGroupOptions */
/** @typedef {import("./Compiler")} Compiler */
/** @typedef {import("./DependenciesBlock")} DependenciesBlock */
/** @typedef {import("./Dependency")} Dependency */
/** @typedef {import("./Dependency").DependencyLocation} DependencyLocation */
/** @typedef {import("./Dependency").ReferencedExport} ReferencedExport */
/** @typedef {import("./DependencyTemplate")} DependencyTemplate */
/** @typedef {import("./Entrypoint").EntryOptions} EntryOptions */
/** @typedef {import("./Module").CodeGenerationResult} CodeGenerationResult */
/** @typedef {import("./ModuleFactory")} ModuleFactory */
/** @typedef {import("./ModuleFactory").ModuleFactoryCreateDataContextInfo} ModuleFactoryCreateDataContextInfo */
/** @typedef {import("./RequestShortener")} RequestShortener */
/** @typedef {import("./RuntimeModule")} RuntimeModule */
/** @typedef {import("./Template").RenderManifestEntry} RenderManifestEntry */
/** @typedef {import("./Template").RenderManifestOptions} RenderManifestOptions */
/** @typedef {import("./stats/DefaultStatsFactoryPlugin").StatsAsset} StatsAsset */
/** @typedef {import("./stats/DefaultStatsFactoryPlugin").StatsError} StatsError */
/** @typedef {import("./stats/DefaultStatsFactoryPlugin").StatsModule} StatsModule */
/** @typedef {import("./util/Hash")} Hash */
/** @template T @typedef {import("./util/deprecation").FakeHook<T>} FakeHook<T> */
/** @typedef {import("./util/runtime").RuntimeSpec} RuntimeSpec */

/**
 * @callback ExecuteModuleCallback
 * @param {WebpackError=} err
 * @param {ExecuteModuleResult=} result
 * @returns {void}
 */

/**
 * @callback DepBlockVarDependenciesCallback
 * @param {Dependency} dependency
 * @returns {any}
 */

/** @typedef {new (...args: any[]) => Dependency} DepConstructor */
/** @typedef {Record<string, Source>} CompilationAssets */

/**
 * @typedef {Object} AvailableModulesChunkGroupMapping
 * @property {ChunkGroup} chunkGroup
 * @property {Set<Module>} availableModules
 * @property {boolean} needCopy
 */

/**
 * @typedef {Object} ChunkPathData
 * @property {string|number} id
 * @property {string=} name
 * @property {string} hash
 * @property {function(number): string=} hashWithLength
 * @property {(Record<string, string>)=} contentHash
 * @property {(Record<string, (length: number) => string>)=} contentHashWithLength
 */

/**
 * @typedef {Object} ChunkHashContext
 * @property {RuntimeTemplate} runtimeTemplate the runtime template
 * @property {ModuleGraph} moduleGraph the module graph
 * @property {ChunkGraph} chunkGraph the chunk graph
 */

/**
 * @typedef {Object} RuntimeRequirementsContext
 * @property {ChunkGraph} chunkGraph the chunk graph
 * @property {CodeGenerationResults} codeGenerationResults the code generation results
 */

/**
 * @typedef {Object} ExecuteModuleOptions
 * @property {EntryOptions=} entryOptions
 */

/**
 * @typedef {Object} ExecuteModuleResult
 * @property {any} exports
 * @property {boolean} cacheable
 * @property {Map<string, { source: Source, info: AssetInfo }>} assets
 * @property {LazySet<string>} fileDependencies
 * @property {LazySet<string>} contextDependencies
 * @property {LazySet<string>} missingDependencies
 * @property {LazySet<string>} buildDependencies
 */

/**
 * @typedef {Object} ExecuteModuleArgument
 * @property {Module} module
 * @property {{ id: string, exports: any, loaded: boolean }=} moduleObject
 * @property {any} preparedInfo
 * @property {CodeGenerationResult} codeGenerationResult
 */

/**
 * @typedef {Object} ExecuteModuleContext
 * @property {Map<string, { source: Source, info: AssetInfo }>} assets
 * @property {Chunk} chunk
 * @property {ChunkGraph} chunkGraph
 * @property {function(string): any=} __webpack_require__
 */

/**
 * @typedef {Object} EntryData
 * @property {Dependency[]} dependencies dependencies of the entrypoint that should be evaluated at startup
 * @property {Dependency[]} includeDependencies dependencies of the entrypoint that should be included but not evaluated
 * @property {EntryOptions} options options of the entrypoint
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} type
 * @property {any[]} args
 * @property {number} time
 * @property {string[]=} trace
 */

/**
 * @typedef {Object} KnownAssetInfo
 * @property {boolean=} immutable true, if the asset can be long term cached forever (contains a hash)
 * @property {boolean=} minimized whether the asset is minimized
 * @property {string | string[]=} fullhash the value(s) of the full hash used for this asset
 * @property {string | string[]=} chunkhash the value(s) of the chunk hash used for this asset
 * @property {string | string[]=} modulehash the value(s) of the module hash used for this asset
 * @property {string | string[]=} contenthash the value(s) of the content hash used for this asset
 * @property {string=} sourceFilename when asset was created from a source file (potentially transformed), the original filename relative to compilation context
 * @property {number=} size size in bytes, only set after asset has been emitted
 * @property {boolean=} development true, when asset is only used for development and doesn't count towards user-facing assets
 * @property {boolean=} hotModuleReplacement true, when asset ships data for updating an existing application (HMR)
 * @property {boolean=} javascriptModule true, when asset is javascript and an ESM
 * @property {Record<string, string | string[]>=} related object of pointers to other assets, keyed by type of relation (only points from parent to child)
 */

/** @typedef {KnownAssetInfo & Record<string, any>} AssetInfo */

/**
 * @typedef {Object} Asset
 * @property {string} name the filename of the asset
 * @property {Source} source source of the asset
 * @property {AssetInfo} info info about the asset
 */

/**
 * @typedef {Object} ModulePathData
 * @property {string|number} id
 * @property {string} hash
 * @property {function(number): string=} hashWithLength
 */

/**
 * @typedef {Object} PathData
 * @property {ChunkGraph=} chunkGraph
 * @property {string=} hash
 * @property {function(number): string=} hashWithLength
 * @property {(Chunk|ChunkPathData)=} chunk
 * @property {(Module|ModulePathData)=} module
 * @property {RuntimeSpec=} runtime
 * @property {string=} filename
 * @property {string=} basename
 * @property {string=} query
 * @property {string=} contentHashType
 * @property {string=} contentHash
 * @property {function(number): string=} contentHashWithLength
 * @property {boolean=} noChunkHash
 * @property {string=} url
 */

/**
 * @typedef {Object} KnownNormalizedStatsOptions
 * @property {string} context
 * @property {RequestShortener} requestShortener
 * @property {string} chunksSort
 * @property {string} modulesSort
 * @property {string} chunkModulesSort
 * @property {string} nestedModulesSort
 * @property {string} assetsSort
 * @property {boolean} ids
 * @property {boolean} cachedAssets
 * @property {boolean} groupAssetsByEmitStatus
 * @property {boolean} groupAssetsByPath
 * @property {boolean} groupAssetsByExtension
 * @property {number} assetsSpace
 * @property {((value: string, asset: StatsAsset) => boolean)[]} excludeAssets
 * @property {((name: string, module: StatsModule, type: "module" | "chunk" | "root-of-chunk" | "nested") => boolean)[]} excludeModules
 * @property {((warning: StatsError, textValue: string) => boolean)[]} warningsFilter
 * @property {boolean} cachedModules
 * @property {boolean} orphanModules
 * @property {boolean} dependentModules
 * @property {boolean} runtimeModules
 * @property {boolean} groupModulesByCacheStatus
 * @property {boolean} groupModulesByLayer
 * @property {boolean} groupModulesByAttributes
 * @property {boolean} groupModulesByPath
 * @property {boolean} groupModulesByExtension
 * @property {boolean} groupModulesByType
 * @property {boolean | "auto"} entrypoints
 * @property {boolean} chunkGroups
 * @property {boolean} chunkGroupAuxiliary
 * @property {boolean} chunkGroupChildren
 * @property {number} chunkGroupMaxAssets
 * @property {number} modulesSpace
 * @property {number} chunkModulesSpace
 * @property {number} nestedModulesSpace
 * @property {false|"none"|"error"|"warn"|"info"|"log"|"verbose"} logging
 * @property {((value: string) => boolean)[]} loggingDebug
 * @property {boolean} loggingTrace
 * @property {any} _env
 */

/** @typedef {KnownNormalizedStatsOptions & Omit<StatsOptions, keyof KnownNormalizedStatsOptions> & Record<string, any>} NormalizedStatsOptions */

/**
 * @typedef {Object} KnownCreateStatsOptionsContext
 * @property {boolean=} forToString
 */

/** @typedef {KnownCreateStatsOptionsContext & Record<string, any>} CreateStatsOptionsContext */

/** @type {AssetInfo} */
const EMPTY_ASSET_INFO = Object.freeze({});

const esmDependencyCategory = "esm";
// compilation.hooks.normalModuleLoader 已被 NormalModule.getCompilationHooks(compilation).loader 替代
const deprecatedNormalModuleLoaderHook = util.deprecate(
	compilation => {
		return require("./NormalModule").getCompilationHooks(compilation).loader;
	},
	"Compilation.hooks.normalModuleLoader was moved to NormalModule.getCompilationHooks(compilation).loader",
	"DEP_WEBPACK_COMPILATION_NORMAL_MODULE_LOADER_HOOK"
);

// TODO webpack 6: remove
// webpack 6 将会移除
// compilation.moduleTemplates.asset 已被移除
// compilation.moduleTemplates.webassembly 已被移除
const defineRemovedModuleTemplates = moduleTemplates => {
	Object.defineProperties(moduleTemplates, {
		asset: {
			enumerable: false,
			configurable: false,
			get: () => {
				throw new WebpackError(
					"Compilation.moduleTemplates.asset has been removed"
				);
			}
		},
		webassembly: {
			enumerable: false,
			configurable: false,
			get: () => {
				throw new WebpackError(
					"Compilation.moduleTemplates.webassembly has been removed"
				);
			}
		}
	});
	moduleTemplates = undefined;
};

const byId = compareSelect(
	/**
	 * @param {Chunk} c chunk
	 * @returns {number | string} id
	 */ c => c.id,
	compareIds
);

const byNameOrHash = concatComparators(
	compareSelect(
		/**
		 * @param {Compilation} c compilation
		 * @returns {string} name
		 */
		c => c.name,
		compareIds
	),
	compareSelect(
		/**
		 * @param {Compilation} c compilation
		 * @returns {string} hash
		 */ c => c.fullHash,
		compareIds
	)
);

const byMessage = compareSelect(err => `${err.message}`, compareStringsNumeric);

const byModule = compareSelect(
	err => (err.module && err.module.identifier()) || "",
	compareStringsNumeric
);

const byLocation = compareSelect(err => err.loc, compareLocations);

const compareErrors = concatComparators(byModule, byLocation, byMessage);

/**
 * 编译过程可以分为以下几个流程
 * 1. 模块的构建
 * 创建模块 并在构建模块的过程中 递归的解析模块中的依赖 构建 模块 与 依赖的图谱关系(ModuleGraph)
 * 2. 分块
 * 根据 入口 进行分块 并构建 块 与 模块 的图谱关系(ChunkGraph)
 * 3. 模块Id 模块哈希值 块Id 块哈希值
 * 4. 优化
 * 优化模块 优化块 优化块中模块
 * 
 * 5. 模块代码生成
 * 
 * 6. 块代码生成
 * 
 * 7. 文件输出
 */

/**
 * 模块图(ModuleGraph) 构建发生在 添加模块 创建模块 构建模块 解析依赖 等的过程中
 * 块图(ChunkGraph) 构建发生在 分块 的过程
 * 在优化阶段
 * 优化依赖  => 分块 => 优化模块 => 优化块 => 优化依赖树 => 优化块模块 => 优化模块Id => 优化块Id =>
 * 
 * 创建模块哈希 => 代码生成任务 => 
 */

/**
 * 
 */

// 编译过程
// 作用:
// 
class Compilation {
	constructor(compiler) {
		// compilation.hooks.normalModuleLoader 已被废弃
		// 可用 NormalModule.getCompilationHooks(compilation).loader 替代
		const getNormalModuleLoader = () => deprecatedNormalModuleLoaderHook(this);
		const processAssetsHook = new AsyncSeriesHook(["assets"]);

		let savedAssets = new Set();
		const popNewAssets = assets => {
			let newAssets = undefined;
			for (const file of Object.keys(assets)) {
				if (savedAssets.has(file)) continue;
				if (newAssets === undefined) {
					newAssets = Object.create(null);
				}
				newAssets[file] = assets[file];
				savedAssets.add(file);
			}
			return newAssets;
		};
		processAssetsHook.intercept({
			name: "Compilation",
			call: () => {
				savedAssets = new Set(Object.keys(this.assets));
			},
			register: tap => {
				const { type, name } = tap;
				const { fn, additionalAssets, ...remainingTap } = tap;
				const additionalAssetsFn =
					additionalAssets === true ? fn : additionalAssets;
				const processedAssets = additionalAssetsFn ? new WeakSet() : undefined;
				switch (type) {
					case "sync":
						if (additionalAssetsFn) {
							this.hooks.processAdditionalAssets.tap(name, assets => {
								if (processedAssets.has(this.assets))
									additionalAssetsFn(assets);
							});
						}
						return {
							...remainingTap,
							type: "async",
							fn: (assets, callback) => {
								try {
									fn(assets);
								} catch (e) {
									return callback(e);
								}
								if (processedAssets !== undefined)
									processedAssets.add(this.assets);
								const newAssets = popNewAssets(assets);
								if (newAssets !== undefined) {
									this.hooks.processAdditionalAssets.callAsync(
										newAssets,
										callback
									);
									return;
								}
								callback();
							}
						};
					case "async":
						if (additionalAssetsFn) {
							this.hooks.processAdditionalAssets.tapAsync(
								name,
								(assets, callback) => {
									if (processedAssets.has(this.assets))
										return additionalAssetsFn(assets, callback);
									callback();
								}
							);
						}
						return {
							...remainingTap,
							fn: (assets, callback) => {
								fn(assets, err => {
									if (err) return callback(err);
									if (processedAssets !== undefined)
										processedAssets.add(this.assets);
									const newAssets = popNewAssets(assets);
									if (newAssets !== undefined) {
										this.hooks.processAdditionalAssets.callAsync(
											newAssets,
											callback
										);
										return;
									}
									callback();
								});
							}
						};
					case "promise":
						if (additionalAssetsFn) {
							this.hooks.processAdditionalAssets.tapPromise(name, assets => {
								if (processedAssets.has(this.assets))
									return additionalAssetsFn(assets);
								return Promise.resolve();
							});
						}
						return {
							...remainingTap,
							fn: assets => {
								const p = fn(assets);
								if (!p || !p.then) return p;
								return p.then(() => {
									if (processedAssets !== undefined)
										processedAssets.add(this.assets);
									const newAssets = popNewAssets(assets);
									if (newAssets !== undefined) {
										return this.hooks.processAdditionalAssets.promise(
											newAssets
										);
									}
								});
							}
						};
				}
			}
		});

		const afterProcessAssetsHook = new SyncHook(["assets"]);

		/**
		 * @template T
		 * @param {string} name name of the hook
		 * @param {number} stage new stage
		 * @param {function(): AsArray<T>} getArgs get old hook function args
		 * @param {string=} code deprecation code (not deprecated when unset)
		 * @returns {FakeHook<Pick<AsyncSeriesHook<T>, "tap" | "tapAsync" | "tapPromise" | "name">>} fake hook which redirects
		 */
		const createProcessAssetsHook = (name, stage, getArgs, code) => {
			const errorMessage =
				reason => `Can't automatically convert plugin using Compilation.hooks.${name} to Compilation.hooks.processAssets because ${reason}.
BREAKING CHANGE: Asset processing hooks in Compilation has been merged into a single Compilation.hooks.processAssets hook.`;
			const getOptions = options => {
				if (typeof options === "string") options = { name: options };
				if (options.stage) {
					throw new Error(errorMessage("it's using the 'stage' option"));
				}
				return { ...options, stage: stage };
			};
			return createFakeHook(
				{
					name,
					/** @type {AsyncSeriesHook<T>["intercept"]} */
					intercept(interceptor) {
						throw new Error(errorMessage("it's using 'intercept'"));
					},
					/** @type {AsyncSeriesHook<T>["tap"]} */
					tap: (options, fn) => {
						processAssetsHook.tap(getOptions(options), () => fn(...getArgs()));
					},
					/** @type {AsyncSeriesHook<T>["tapAsync"]} */
					tapAsync: (options, fn) => {
						processAssetsHook.tapAsync(
							getOptions(options),
							(assets, callback) =>
								/** @type {any} */ (fn)(...getArgs(), callback)
						);
					},
					/** @type {AsyncSeriesHook<T>["tapPromise"]} */
					tapPromise: (options, fn) => {
						processAssetsHook.tapPromise(getOptions(options), () =>
							fn(...getArgs())
						);
					}
				},
				`${name} is deprecated (use Compilation.hooks.processAssets instead and use one of Compilation.PROCESS_ASSETS_STAGE_* as stage option)`,
				code
			);
		};
		this.hooks = Object.freeze({
			// 当添加完单项入口后
			// RuntimeChunkPlugin
			// ProgressPlugin
			addEntry: new SyncHook(["entry", "options"]),
			// 当在构建单项入口的模块树的过程中出错时
			// ProgressPlugin
			failedEntry: new SyncHook(["entry", "options", "error"]),
			// 当成功构建完单项入口的模块树后
			succeedEntry: new SyncHook(["entry", "options", "module"]),

			// 在单个模块构建开始之前
			// SourceMapDevToolModuleOptionsPlugin
			// ProgressPlugin
			buildModule: new SyncHook(["module"]),
			// 在重新单个模块构建开始之前
			// FlagDependencyExportsPlugin
			rebuildModule: new SyncHook(["module"]),
			// 当单个模块构建失败后
			failedModule: new SyncHook(["module", "error"]),
			// 当单个模块构建成功后
			succeedModule: new SyncHook(["module"]),
			// 空调用
			// 
			stillValidModule: new SyncHook(["module"]),
			
			// 
			dependencyReferencedExports: new SyncWaterfallHook([
				"referencedExports",
				"dependency",
				"runtime"
			]),
			// 
			// JavascriptModulesPlugin
			executeModule: new SyncHook(["options", "context"]),
			// 
			// AssetModulesPlugin
			prepareModuleExecution: new AsyncParallelHook(["options", "context"]),
			// 当所有的模块都构建完成时
			// 所有的入口都已构建完成 ??
			// FlagDependencyExportsPlugin
			// InferAsyncModulesPlugin
			// ResolverCachePlugin
			// AbstractLibraryPlugin
			// InnerGraphPlugin
			// WasmFinalizeExportsPlugin
			finishModules: new AsyncSeriesHook(["modules"]),
			// 
			// FlagDependencyExportsPlugin
			finishRebuildingModule: new AsyncSeriesHook(["module"]),
			// 解除冻结
			unseal: new SyncHook([]),

			// 冻结(compilation对象停止接受新的模块)
			// FlagEntryExportAsUsedPlugin
			// WarnCaseSensitiveModulesPlugin
			seal: new SyncHook([]),
			// 在分块之前
			beforeChunks: new SyncHook([]),
			// 在分块后
			// WebAssemblyModulesPlugin
			afterChunks: new SyncHook(["chunks"]),
			// 开始优化依赖
			// FlagAllModulesAsUsedPlugin
			// FlagDependencyUsagePlugin
			// SideEffectsFlagPlugin
			optimizeDependencies: new SyncBailHook(["modules"]),
			// 当优化完依赖后
			// WebAssemblyModulesPlugin
			afterOptimizeDependencies: new SyncHook(["modules"]),
			// 在所有的优化开始前
			// AggressiveSplittingPlugin
			optimize: new SyncHook([]),
			// 当优化模块前
			// 在执行完 compilation.hooks.optimize 后立即执行
			optimizeModules: new SyncBailHook(["modules"]),
			// 在优化完所有的模块后
			// 在执行完 compilation.hooks.optimizeModules 后立即执行
			afterOptimizeModules: new SyncHook(["modules"]),
			// 当优化块时
			// 在执行完 compilation.hooks.afterOptimizeModules 后立即执行
			// AggressiveMergingPlugin
			// AggressiveSplittingPlugin
			// EnsureChunkConditionsPlugin
			// LimitChunkCountPlugin
			// MergeDuplicateChunksPlugin
			// MinChunkSizePlugin
			// RemoveEmptyChunksPlugin
			// RemoveParentModulesPlugin
			// SplitChunksPlugin
			optimizeChunks: new SyncBailHook(["chunks", "chunkGroups"]),
			// 当优化玩所有的块后
			// 在执行完 compilation.hooks.optimizeChunks 后立即执行
			afterOptimizeChunks: new SyncHook(["chunks", "chunkGroups"]),
			// 执行执行回调
			// 当优化依赖树时
			// 在执行完 compilation.hooks.afterOptimizeChunks 后立即执行
			optimizeTree: new AsyncSeriesHook(["chunks", "modules"]),
			// 当优化完依赖树后
			// 在执行完 compilation.hooks.optimizeTree 后立即执行
			afterOptimizeTree: new SyncHook(["chunks", "modules"]),
			// 直接执行回调
			// 在树优化之后，chunk 模块优化开始时
			// 在执行完 compilation.hooks.afterOptimizeTree 后立即执行
			// ModuleConcatenationPlugin
			optimizeChunkModules: new AsyncSeriesBailHook(["chunks", "modules"]),
			// 在 chunk 模块优化成功完成之后调用
			// 在执行完 compilation.hooks.optimizeChunkModules 后立即执行
			afterOptimizeChunkModules: new SyncHook(["chunks", "modules"]),

			// 用来决定是否存储 record
			// 在执行完 compilation.hooks.afterOptimizeChunkModules 后立即执行
			// NoEmitOnErrorsPlugin
			shouldRecord: new SyncBailHook([]),
			// 
			runtimeModule: new SyncHook(["module", "chunk"]),
			// 从 record 中恢复模块信息
			// RecordIdsPlugin
			reviveModules: new SyncHook(["modules", "records"]),
			// 在为每个模块分配 id 之前执行
			beforeModuleIds: new SyncHook(["modules"]),
			// 当给每个模块分配 id 时
			// 设置 Module 对应的 ChunkGraphModule.id
			// ChunkModuleIdRangePlugin
			// DeterministicModuleIdsPlugin
			// HashedModuleIdsPlugin
			// NamedModuleIdsPlugin
			// NaturalModuleIdsPlugin
			// OccurrenceModuleIdsPlugin
			moduleIds: new SyncHook(["modules"]),
			// 在模块 id 优化开始时调用
			optimizeModuleIds: new SyncHook(["modules"]),
			// 在模块 id 优化完成时调用
			afterOptimizeModuleIds: new SyncHook(["modules"]),
			// 从 record 中恢复 chunk 信息
			// RecordIdsPlugin
			reviveChunks: new SyncHook(["chunks", "records"]),
			// 在为每个 chunk 分配 id 之前执行
			beforeChunkIds: new SyncHook(["chunks"]),
			// 当给每个 chunk 分配一个 id时
			// 设置 Chunk.id
			// DeterministicChunkIdsPlugin
			// NamedChunkIdsPlugin
			// NaturalChunkIdsPlugin
			// OccurrenceChunkIdsPlugin
			chunkIds: new SyncHook(["chunks"]),
			// 在 chunk id 优化阶段开始时调用
			// FlagIncludedChunksPlugin
			optimizeChunkIds: new SyncHook(["chunks"]),
			// 当chunk id 优化结束之后调用
			afterOptimizeChunkIds: new SyncHook(["chunks"]),
			// 将模块信息存储到 record 中
			// RecordIdsPlugin
			recordModules: new SyncHook(["modules", "records"]),
			// 将 chunk 存储到 record 中
			// RecordIdsPlugin
			recordChunks: new SyncHook(["chunks", "records"]),
			// 
			// MangleExportsPlugin
			optimizeCodeGeneration: new SyncHook(["modules"]),
			// 在创建模块哈希（hash）之前
			beforeModuleHash: new SyncHook([]),
			// 在创建模块哈希（hash）之后
			afterModuleHash: new SyncHook([]),
			// 
			beforeCodeGeneration: new SyncHook([]),
			//
			afterCodeGeneration: new SyncHook([]),

			// 
			beforeRuntimeRequirements: new SyncHook([]),
			// TODO:
			// 当前模块 以及 所需要的 运行时变量
			runtimeRequirementInModule: new HookMap(
				() => new SyncBailHook(["module", "runtimeRequirements", "context"])
			),
			// TODO:
			// 当前模块 以及 所需要的 运行时变量
			additionalModuleRuntimeRequirements: new SyncHook([
				"module",
				"runtimeRequirements",
				"context"
			]),
			// TODO:
			// 当前chunk 以及 所需要的 运行时变量
			runtimeRequirementInChunk: new HookMap(
				() => new SyncBailHook(["chunk", "runtimeRequirements", "context"])
			),
			// TODO:
			// 当前chunk 以及 所需要的 运行时变量
			// ModuleChunkFormatPlugin
			// ArrayPushCallbackChunkFormatPlugin
			// CommonJsChunkFormatPlugin
			// AbstractLibraryPlugin
			// ChunkPrefetchPreloadPlugin
			additionalChunkRuntimeRequirements: new SyncHook([
				"chunk",
				"runtimeRequirements",
				"context"
			]),
			// 根据  添加运行时模块
			// APIPlugin
			// RuntimePlugin
			// ContainerReferencePlugin
			// AMDPlugin
			// CommonJsPlugin
			// ModuleChunkLoadingPlugin
			// CommonJsChunkLoadingPlugin
			// ReadFileCompileAsyncWasmPlugin
			// ReadFileCompileWasmPlugin
			// ChunkPrefetchPreloadPlugin
			// StartupChunkDependenciesPlugin
			// FetchCompileAsyncWasmPlugin
			// FetchCompileWasmPlugin
			// JsonpChunkLoadingPlugin
			// ImportScriptsChunkLoadingPlugin
			runtimeRequirementInTree: new HookMap(
				() => new SyncBailHook(["chunk", "runtimeRequirements", "context"])
			),
			// 根据 添加运行时模块 并设置
			// HotModuleReplacementPlugin
			// RuntimePlugin
			// JavascriptModulesPlugin
			// ChunkPrefetchPreloadPlugin
			// StartupChunkDependenciesPlugin
			// ConsumeSharedPlugin
			additionalTreeRuntimeRequirements: new SyncHook([
				"chunk",
				"runtimeRequirements",
				"context"
			]),
			// 
			afterRuntimeRequirements: new SyncHook([]),

			// 在 compilation 添加哈希（hash）之前
			beforeHash: new SyncHook([]),
			// 
			// JavascriptModulesPlugin
			contentHash: new SyncHook(["chunk"]),
			// 在 compilation 添加哈希（hash）之后
			afterHash: new SyncHook([]),
			// 将有关 record 的信息存储到 records 中
			// AggressiveSplittingPlugin
			recordHash: new SyncHook(["records"]),
			// 将 compilation 相关信息存储到 record 中
			// HotModuleReplacementPlugin
			record: new SyncHook(["compilation", "records"]),
			// 在创建模块 asset 之前执行
			beforeModuleAssets: new SyncHook([]),
			// 用来确定是否生成 chunk asset
			shouldGenerateChunkAssets: new SyncBailHook([]),
			// 在创建 chunk asset 之前
			beforeChunkAssets: new SyncHook([]),
			// 废弃
			// compilation.hooks.additionalChunkAssets 已被 compilation.hooks.processAssets 替代
			additionalChunkAssets: createProcessAssetsHook(
				"additionalChunkAssets",
				Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				() => [this.chunks],
				"DEP_WEBPACK_COMPILATION_ADDITIONAL_CHUNK_ASSETS"
			),
			// 为 compilation 创建额外 asset
			// webpack 6 将会移除
			additionalAssets: createProcessAssetsHook(
				"additionalAssets",
				Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				() => []
			),
			// webpack 6 将会移除
			optimizeChunkAssets: createProcessAssetsHook(
				"optimizeChunkAssets",
				Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
				() => [this.chunks],
				"DEP_WEBPACK_COMPILATION_OPTIMIZE_CHUNK_ASSETS"
			),
			// webpack 6 将会移除
			afterOptimizeChunkAssets: createProcessAssetsHook(
				"afterOptimizeChunkAssets",
				Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE + 1,
				() => [this.chunks],
				"DEP_WEBPACK_COMPILATION_AFTER_OPTIMIZE_CHUNK_ASSETS"
			),
			// webpack 6 将会移除
			optimizeAssets: processAssetsHook,
			// webpack 6 将会移除
			afterOptimizeAssets: afterProcessAssetsHook,
			// 对 assets 进行加工处理
			// BannerPlugin
			// HotModuleReplacementPlugin
			// SourceMapDevToolPlugin
			// RealContentHashPlugin
			processAssets: processAssetsHook,
			// 对 assets 加工处理无报错后立即调用
			afterProcessAssets: afterProcessAssetsHook,
			// 
			processAdditionalAssets: new AsyncSeriesHook(["assets"]),
			// 调用来决定 compilation 是否需要解除 seal 以引入其他文件
			// AggressiveSplittingPlugin
			needAdditionalSeal: new SyncBailHook([]),
			// 
			afterSeal: new AsyncSeriesHook([]),
			// 当获取 chunk render 时
			// AssetModulesPlugin
			// JavascriptModulesPlugin
			// WebAssemblyModulesPlugin
			// WebAssemblyModulesPlugin
			renderManifest: new SyncWaterfallHook(["result", "options"]),
			// 
			// HotModuleReplacementPlugin
			fullHash: new SyncHook(["hash"]),
			// 当给每个 chunk 生成 hash时
			// EvalDevToolModulePlugin
			// EvalSourceMapDevToolPlugin
			// ModuleInfoHeaderPlugin
			// RuntimePlugin
			// ModuleChunkFormatPlugin
			// ArrayPushCallbackChunkFormatPlugin
			// CommonJsChunkFormatPlugin
			// JavascriptModulesPlugin
			// AbstractLibraryPlugin
			chunkHash: new SyncHook(["chunk", "chunkHash", "ChunkHashContext"]),
			// 当一个模块中的一个 asset 被添加到 compilation 时调用
			moduleAsset: new SyncHook(["module", "filename"]),
			// 当一个 chunk 中的一个 asset 被添加到 compilation 时调用
			chunkAsset: new SyncHook(["chunk", "filename"]),
			// 通过此钩子决定 asset 的路径
			// TemplatedPathPlugin
			assetPath: new SyncWaterfallHook(["path", "options", "assetInfo"]),
			// 空调用
			// 当 compiler 输出 assets 后是否需要进一步处理
			needAdditionalPass: new SyncBailHook([]),

			/** @type {SyncHook<[Compiler, string, number]>} */
			childCompiler: new SyncHook([
				"childCompiler",
				"compilerName",
				"compilerIndex"
			]),
			// 在每次日志输出前
			log: new SyncBailHook(["origin", "logEntry"]),
			// 当获取 compilation.warnings 时
			// 当调用 compilation.getWarnings 时
			// IgnoreWarningsPlugin
			processWarnings: new SyncWaterfallHook(["warnings"]),
			// 当获取 compilation.errors 时
			// 当调用 compilation.errors 时
			processErrors: new SyncWaterfallHook(["errors"]),
			// 对 Webpack.options.stats.preset 属性进行加工处理
			statsPreset: new HookMap(() => new SyncHook(["options", "context"])),
			// 对 Webpack.options.stats 属性进行加工处理
			// DefaultStatsPresetPlugin
			statsNormalize: new SyncHook(["options", "context"]),
			// 当创建完 StatsFactory 的实例后
			// DefaultStatsFactoryPlugin
			statsFactory: new SyncHook(["statsFactory", "options"]),
			// 当创建完 StatsPrinter 的实例后
			// DefaultStatsPrinterPlugin
			statsPrinter: new SyncHook(["statsPrinter", "options"]),

			get normalModuleLoader() {
				return getNormalModuleLoader();
			}
		});

		// 编译过程名称
		// Webpack.options.name
		this.name = undefined;
		// 编译过程开始时间(时间戳 以ms为单位)
		this.startTime = undefined;
		// 编译过程结束时间(时间戳 以ms为单位)
		this.endTime = undefined;

		// 编译器
		this.compiler = compiler;
		// 路径解析器
		this.resolverFactory = compiler.resolverFactory;
		// 输入文件系统
		this.inputFileSystem = compiler.inputFileSystem;
		// TODO: 文件系统
		this.fileSystemInfo = new FileSystemInfo(this.inputFileSystem, {
			managedPaths: compiler.managedPaths,
			immutablePaths: compiler.immutablePaths,
			logger: this.getLogger("webpack.FileSystemInfo")
		});
		if (compiler.fileTimestamps) {
			this.fileSystemInfo.addFileTimestamps(compiler.fileTimestamps);
		}
		if (compiler.contextTimestamps) {
			this.fileSystemInfo.addContextTimestamps(compiler.contextTimestamps);
		}
		// 缓存值(DefinePlugin)
		this.valueCacheVersions = new Map();
		// 路径缩短器
		this.requestShortener = compiler.requestShortener;
		// 
		this.compilerPath = compiler.compilerPath;
		// 日志对象
		this.logger = this.getLogger("webpack.Compilation");

		// Webpack.options
		const options = compiler.options;
		this.options = options;
		// Webpack.options.output
		this.outputOptions = options && options.output;
		// Webpack.options.bail
		this.bail = (options && options.bail) || false;
		// Webpack.options.profile
		this.profile = (options && options.profile) || false;

		// 模板
		// 废弃
		this.mainTemplate = new MainTemplate(this.outputOptions, this);
		// 废弃
		this.chunkTemplate = new ChunkTemplate(this.outputOptions, this);
		// 运行时模板
		this.runtimeTemplate = new RuntimeTemplate(
			this,
			this.outputOptions,
			this.requestShortener
		);
		// this.moduleTemplates.javascript 属性即将废弃
		this.moduleTemplates = {
			javascript: new ModuleTemplate(this.runtimeTemplate, this)
		};
		// this.moduleTemplates
		// this.moduleTemplates.asset 属性废弃
		// this.moduleTemplates.webassembly 属性废弃
		defineRemovedModuleTemplates(this.moduleTemplates);

		// 模块图
		this.moduleGraph = new ModuleGraph();
		// 块图
		this.chunkGraph = undefined;

		// 缓存 Module生成的代码结果
		// CodeGenerationResults
		this.codeGenerationResults = undefined;

		// 任务队列
		// 解析依赖队列
		// AsyncQueue<Module, Module, Module>
		this.processDependenciesQueue = new AsyncQueue({
			name: "processDependencies",
			// 并行
			parallelism: options.parallelism || 100,
			// 处理器
			processor: this._processModuleDependencies.bind(this)
		});
		// 添加模块队列
		// AsyncQueue<Module, string, Module>
		this.addModuleQueue = new AsyncQueue({
			name: "addModule",
			parent: this.processDependenciesQueue,
			getKey: module => module.identifier(),
			processor: this._addModule.bind(this)
		});
		// 创建模块队列
		// AsyncQueue<FactorizeModuleOptions, string, Module>
		this.factorizeQueue = new AsyncQueue({
			name: "factorize",
			parent: this.addModuleQueue,
			processor: this._factorizeModule.bind(this)
		});
		// 构建模块队列
		// AsyncQueue<Module, Module, Module>
		this.buildQueue = new AsyncQueue({
			name: "build",
			parent: this.factorizeQueue,
			processor: this._buildModule.bind(this)
		});
		// 重新构建模块队列
		// AsyncQueue<Module, Module, Module>
		this.rebuildQueue = new AsyncQueue({
			name: "rebuild",
			parallelism: options.parallelism || 100,
			processor: this._rebuildModule.bind(this)
		});

		/**
		 * Modules in value are building during the build of Module in key.
		 * Means value blocking key from finishing.
		 * Needed to detect build cycles.
		 * @type {WeakMap<Module, Set<Module>>}
		 */
		this.creatingModuleDuringBuild = new WeakMap();

		// 入口
		// 入口文件映射(单页面应用 或者 多页面应用) Map<EntryName, EntryData>
		this.entries = new Map();
		// 全局入口
		this.globalEntry = {
			dependencies: [],
			includeDependencies: [],
			options: {
				name: undefined
			}
		};
		// 入口点<入口名, Entrypoint>
		// Map<EntrypointName, Entrypoint>
		this.entrypoints = new Map();
		// 异步入口点 Array<Entrypoint>
		this.asyncEntrypoints = [];

		// Set<Chunk>
		this.chunks = new Set();
		arrayToSetDeprecation(this.chunks, "Compilation.chunks");
		// 块组 Array<ChunkGroup>
		this.chunkGroups = [];
		// Map<ChunkGroupName, ChunkGroup>
		this.namedChunkGroups = new Map();
		// Map<ChunkName, Chunk>
		this.namedChunks = new Map();

		// 缓存的模块
		// Set<Module>
		this.modules = new Set();
		arrayToSetDeprecation(this.modules, "Compilation.modules");
		// 缓存模块 Map<ModuleId, Module>
		this._modules = new Map();
		// 文件记录
		this.records = null;
		//
		// Array<String>
		this.additionalChunkAssets = [];
		// 编译完成后输出的资源
		// Object<Filename, Source>
		this.assets = {};
		// 编译完成后输出的资源信息
		// Map<Filename, AssetInfo>
		this.assetsInfo = new Map();
		// 
		// Map<string, Map<string, Set<string>>>
		this._assetsRelatedIn = new Map();

		// 当前编译过程中出现的错误 Array<WebpackError>
		this.errors = [];
		// 当前编译过程中出现的警告 Array<WebpackError>
		this.warnings = [];
		// 子编译过程 Array<Compilation>
		this.children = [];
		// Map<string, LogEntry[]>
		this.logging = new Map();

		// 依赖工厂
		// 根据 依赖 找到对应的 模块工厂
		// 通过 模块工厂 来创建对应的 模块实例
		// Map<DependencyConstructor, ModuleFactory>
		this.dependencyFactories = new Map();
		// 依赖模板
		// 根据 依赖 找到对应的 依赖模板
		// 通过 依赖模板 来获取 转换后的依赖代码
		// 例如: import ... from ... => const ... = __webpack_require__('...')
		// Map<DependencyConstructor, DependencyTemplate>
		this.dependencyTemplates = new DependencyTemplates();
		// 
		this.childrenCounters = {};
		// 
		// Set<number|string>
		this.usedChunkIds = null;
		// 
		/** @type {Set<number>} */
		this.usedModuleIds = null;
		/** @type {boolean} */
		this.needAdditionalPass = false;
		// 存储 已经被构建过的Module
		// WeakSet<Module>
		this.builtModules = new WeakSet();

		// 已经生成结果的 Module
		// WeakSet<Module>
		this.codeGeneratedModules = new WeakSet();
		// 
		// WeakSet<Module>
		this.buildTimeExecutedModules = new WeakSet();
		// Map<Module, Callback[]>
		this._rebuildingModules = new Map();
		// 当前编译过程结束后输出的文件名
		// Set<Filename>
		this.emittedAssets = new Set();
		// 当前编译过程结束后输出的文件名(与上次输出结果对比 有改变)
		// Set<Filename>
		this.comparedForEmitAssets = new Set();

		// 文件依赖(整个编译过程中)
		this.fileDependencies = new LazySet();
		// 上下文依赖
		this.contextDependencies = new LazySet();
		// 缺失的依赖
		this.missingDependencies = new LazySet();
		// 打包依赖
		this.buildDependencies = new LazySet();
		// Compilation.compilationDependencies 将在 webpack 6 移除
		// Compilation.compilationDependencies 已被 compilation.fileDependencies 替代
		this.compilationDependencies = {
			add: util.deprecate(
				item => this.fileDependencies.add(item),
				"Compilation.compilationDependencies is deprecated (used Compilation.fileDependencies instead)",
				"DEP_WEBPACK_COMPILATION_COMPILATION_DEPENDENCIES"
			)
		};

		// 缓存对象(底层仍然是调用 compiler.cache.hooks )
		// 模块缓存对象
		this._modulesCache = this.getCache("Compilation/modules");
		// 资源缓存对象
		this._assetsCache = this.getCache("Compilation/assets");
		// 代码生成缓存对象
		this._codeGenerationCache = this.getCache("Compilation/codeGeneration");
	}

	// 返回 Stats 实例
	getStats() {
		return new Stats(this);
	}

	// 标准化 Webpack.options.stats 属性
	createStatsOptions(optionsOrPreset, context = {}) {
		// Webpack.options.stats = 'String' || 'Boolean'
		if (
			typeof optionsOrPreset === "boolean" ||
			typeof optionsOrPreset === "string"
		) {
			optionsOrPreset = { preset: optionsOrPreset };
		}
		// Webpack.options.stats = 'Object'
		if (typeof optionsOrPreset === "object" && optionsOrPreset !== null) {
			const options = {};
			for (const key in optionsOrPreset) {
				options[key] = optionsOrPreset[key];
			}
			if (options.preset !== undefined) {
				// 
				this.hooks.statsPreset.for(options.preset).call(options, context);
			}
			this.hooks.statsNormalize.call(options, context);
			return (options);
		} else {
			const options = {};
			this.hooks.statsNormalize.call(options, context);
			return (options);
		}
	}

	// 返回 StatsFactory 实例
	createStatsFactory(options) {
		const statsFactory = new StatsFactory();
		this.hooks.statsFactory.call(statsFactory, options);
		return statsFactory;
	}

	// 返回 StatsPrinter 实例
	createStatsPrinter(options) {
		const statsPrinter = new StatsPrinter();
		this.hooks.statsPrinter.call(statsPrinter, options);
		return statsPrinter;
	}

	// 返回 Cache
	getCache(name) {
		return this.compiler.getCache(name);
	}

	// 返回logger
	getLogger(name) {
		if (!name) {
			throw new TypeError("Compilation.getLogger(name) called without a name");
		}
		/** @type {LogEntry[] | undefined} */
		let logEntries;
		return new Logger(
			(type, args) => {
				if (typeof name === "function") {
					name = name();
					if (!name) {
						throw new TypeError(
							"Compilation.getLogger(name) called with a function not returning a name"
						);
					}
				}
				let trace;
				switch (type) {
					case LogType.warn:
					case LogType.error:
					case LogType.trace:
						trace = ErrorHelpers.cutOffLoaderExecution(new Error("Trace").stack)
							.split("\n")
							.slice(3);
						break;
				}
				/** @type {LogEntry} */
				const logEntry = {
					time: Date.now(),
					type,
					args,
					trace
				};
				// 日志输出(仅输出 profile )
				if (this.hooks.log.call(name, logEntry) === undefined) {
					if (logEntry.type === LogType.profileEnd) {
						if (typeof console.profileEnd === "function") {
							console.profileEnd(`[${name}] ${logEntry.args[0]}`);
						}
					}
					if (logEntries === undefined) {
						logEntries = this.logging.get(name);
						if (logEntries === undefined) {
							logEntries = [];
							// 存储日志信息
							this.logging.set(name, logEntries);
						}
					}
					logEntries.push(logEntry);
					if (logEntry.type === LogType.profile) {
						if (typeof console.profile === "function") {
							console.profile(`[${name}] ${logEntry.args[0]}`);
						}
					}
				}
			},
			childName => {
				if (typeof name === "function") {
					if (typeof childName === "function") {
						return this.getLogger(() => {
							if (typeof name === "function") {
								name = name();
								if (!name) {
									throw new TypeError(
										"Compilation.getLogger(name) called with a function not returning a name"
									);
								}
							}
							if (typeof childName === "function") {
								childName = childName();
								if (!childName) {
									throw new TypeError(
										"Logger.getChildLogger(name) called with a function not returning a name"
									);
								}
							}
							return `${name}/${childName}`;
						});
					} else {
						return this.getLogger(() => {
							if (typeof name === "function") {
								name = name();
								if (!name) {
									throw new TypeError(
										"Compilation.getLogger(name) called with a function not returning a name"
									);
								}
							}
							return `${name}/${childName}`;
						});
					}
				} else {
					if (typeof childName === "function") {
						return this.getLogger(() => {
							if (typeof childName === "function") {
								childName = childName();
								if (!childName) {
									throw new TypeError(
										"Logger.getChildLogger(name) called with a function not returning a name"
									);
								}
							}
							return `${name}/${childName}`;
						});
					} else {
						return this.getLogger(`${name}/${childName}`);
					}
				}
			}
		);
	}

	// 向添加模块队列中 添加添加模块任务
	addModule(module, callback) {
		this.addModuleQueue.add(module, callback);
	}

	// 添加模块
	// 1. 在不同的缓存策略中 根据模块标识符 读取缓存的模块 如果读取到缓存的模块 则直接使用缓存的模块
	// 2. 缓存模块到当前构建过程中: compilation.modules compilation._modules
	// 3. 在模块图中 绑定 当前Module 与 ModuleGraph 的关联关系
	_addModule(module, callback) {
		// 获取模块标识符
		const identifier = module.identifier();
		const alreadyAddedModule = this._modules.get(identifier);
		// 当前模块已被缓存
		if (alreadyAddedModule) {
			return callback(null, alreadyAddedModule);
		}

		// 性能分析: 记录模块
		const currentProfile = this.profile
			? this.moduleGraph.getProfile(module)
			: undefined;
		if (currentProfile !== undefined) {
			currentProfile.markRestoringStart();
		}

		// 根据 Webpack.options.Cache.type 不同的值 使用不同的缓存策略来读取缓存的 模块
		this._modulesCache.get(identifier, null, (err, cacheModule) => {
			if (err) return callback(new ModuleRestoreError(module, err));

			if (currentProfile !== undefined) {
				currentProfile.markRestoringEnd();
				currentProfile.markIntegrationStart();
			}

			// 当前模块之前已经被缓存 则更新缓存中的当前模块
			if (cacheModule) {
				cacheModule.updateCacheModule(module);

				module = cacheModule;
			}
			// 缓存当前模块
			this._modules.set(identifier, module);
			this.modules.add(module);
			// 在模块图中 绑定 当前Module 与 ModuleGraph 的关联关系
			// ModuleGraph.setModuleGraphForModule(module, this.moduleGraph)
			ModuleGraph.setModuleGraphForModule(module, this.moduleGraph);
			if (currentProfile !== undefined) {
				currentProfile.markIntegrationEnd();
			}
			callback(null, module);
		});
	}

	// 根据 module.id 返回 Module
	getModule(module) {
		const identifier = module.identifier();
		return this._modules.get(identifier);
	}
	
	// 根据 Module.id 返回 Module
	findModule(identifier) {
		return this._modules.get(identifier);
	}

	// 构建模块队列中 添加构建模块任务
	buildModule(module, callback) {
		this.buildQueue.add(module, callback);
	}

	// 构建模块
	// 1. 先判断 当前模块 是否需要构建
	// 2. 构建 当前模块
	// 3. 缓存构建后的模块信息
	// 4. 运行所有加载器 返回加载器处理后的源代码 Source
	// 5. 将 加载器处理后的源代码Source 封装成 WebpackSource 的实例
	// 6. 对 源代码 通过 语法分析器 进行词法、语法分析
	// 7. 创建 当前标准模块 的快照
	_buildModule(module, callback) {
		const currentProfile = this.profile
			? this.moduleGraph.getProfile(module)
			: undefined;
		if (currentProfile !== undefined) {
			currentProfile.markBuildingStart();
		}

		// 在构建模块时 先判断 当前模块 是否需要构建
		// 原因: 某些类型的模块不需要经过构建 如运行时模块
		module.needBuild(
			{
				fileSystemInfo: this.fileSystemInfo,
				valueCacheVersions: this.valueCacheVersions
			},
			(err, needBuild) => {
				if (err) return callback(err);

				// 当前模块 不需要经过构建
				if (!needBuild) {
					if (currentProfile !== undefined) {
						currentProfile.markBuildingEnd();
					}
					// 空调用
					this.hooks.stillValidModule.call(module);
					return callback();
				}

				// 空调用
				this.hooks.buildModule.call(module);
				// 缓存
				this.builtModules.add(module);

				// 构建模块
				// 解析模块 获取source文件和dependencies
				module.build(
					this.options,
					this,
					this.resolverFactory.get("normal", module.resolveOptions),
					this.inputFileSystem,
					err => {
						if (currentProfile !== undefined) {
							currentProfile.markBuildingEnd();
						}
						if (err) {
							this.hooks.failedModule.call(module, err);
							return callback(err);
						}
						if (currentProfile !== undefined) {
							currentProfile.markStoringStart();
						}
						// 缓存构建后的 模块
						// 根据 Webpack.options.Cache.type 不同的值 使用不同的缓存策略缓存模块
						this._modulesCache.store(module.identifier(), null, module, err => {
							if (currentProfile !== undefined) {
								currentProfile.markStoringEnd();
							}
							if (err) {
								// 当 模块 构建失败时
								this.hooks.failedModule.call(module, err);
								return callback(new ModuleStoreError(module, err));
							}
							// 空调用
							// 当 模块 被成功构建后
							this.hooks.succeedModule.call(module);
							return callback();
						});
					}
				);
			}
		);
	}

	// 向解析依赖队列中 添加解析依赖任务
	processModuleDependencies(module, callback) {
		this.processDependenciesQueue.add(module, callback);
	}

	// 非递归的解析模块中的依赖   
	// 只解析 某个模块 中的依赖
	processModuleDependenciesNonRecursive(module) {
		const processDependenciesBlock = block => {
			if (block.dependencies) {
				for (const dep of block.dependencies) {
					this.moduleGraph.setParents(dep, block, module);
				}
			}
			if (block.blocks) {
				for (const b of block.blocks) processDependenciesBlock(b);
			}
		};

		processDependenciesBlock(module);
	}

	// 解析 模块 中的依赖 和 异步模块
	// 并处理依赖中包含的模块创建过程 handleModuleCreation
	_processModuleDependencies(module, callback) {
		/**
		 * @type {Array<{factory: ModuleFactory, dependencies: Dependency[], originModule: Module|null}>}
		 */
		const sortedDependencies = [];

		/** @type {DependenciesBlock} */
		let currentBlock;

		/** @type {Map<ModuleFactory, Map<string, Dependency[]>>} */
		let dependencies;
		/** @type {DepConstructor} */
		let factoryCacheKey;
		/** @type {ModuleFactory} */
		let factoryCacheKey2;
		/** @type {Map<string, Dependency[]>} */
		let factoryCacheValue;
		/** @type {string} */
		let listCacheKey1;
		/** @type {string} */
		let listCacheKey2;
		/** @type {Dependency[]} */
		let listCacheValue;

		// 解析 依赖
		const processDependency = dep => {
			this.moduleGraph.setParents(dep, currentBlock, module);
			const resourceIdent = dep.getResourceIdentifier();
			if (resourceIdent !== undefined && resourceIdent !== null) {
				const category = dep.category;
				const constructor = /** @type {DepConstructor} */ (dep.constructor);
				if (factoryCacheKey === constructor) {
					// Fast path 1: same constructor as prev item
					if (listCacheKey1 === category && listCacheKey2 === resourceIdent) {
						// Super fast path 1: also same resource
						listCacheValue.push(dep);
						return;
					}
				} else {
					const factory = this.dependencyFactories.get(constructor);
					if (factory === undefined) {
						throw new Error(
							`No module factory available for dependency type: ${constructor.name}`
						);
					}
					if (factoryCacheKey2 === factory) {
						// Fast path 2: same factory as prev item
						factoryCacheKey = constructor;
						if (listCacheKey1 === category && listCacheKey2 === resourceIdent) {
							// Super fast path 2: also same resource
							listCacheValue.push(dep);
							return;
						}
					} else {
						// Slow path
						if (factoryCacheKey2 !== undefined) {
							// Archive last cache entry
							if (dependencies === undefined) dependencies = new Map();
							dependencies.set(factoryCacheKey2, factoryCacheValue);
							factoryCacheValue = dependencies.get(factory);
							if (factoryCacheValue === undefined) {
								factoryCacheValue = new Map();
							}
						} else {
							factoryCacheValue = new Map();
						}
						factoryCacheKey = constructor;
						factoryCacheKey2 = factory;
					}
				}
				// Here webpack is using heuristic that assumes
				// mostly esm dependencies would be used
				// so we don't allocate extra string for them
				const cacheKey =
					category === esmDependencyCategory
						? resourceIdent
						: `${category}${resourceIdent}`;
				let list = factoryCacheValue.get(cacheKey);
				if (list === undefined) {
					factoryCacheValue.set(cacheKey, (list = []));
					sortedDependencies.push({
						factory: factoryCacheKey2,
						dependencies: list,
						originModule: module
					});
				}
				list.push(dep);
				listCacheKey1 = category;
				listCacheKey2 = resourceIdent;
				listCacheValue = list;
			}
		};

		try {
			/** @type {DependenciesBlock[]} */
			const queue = [module];
			do {
				const block = queue.pop();
				// 模块中依赖
				if (block.dependencies) {
					currentBlock = block;
					for (const dep of block.dependencies) processDependency(dep);
				}
				// 模块中的异步模块
				if (block.blocks) {
					for (const b of block.blocks) queue.push(b);
				}
			} while (queue.length !== 0);
		} catch (e) {
			return callback(e);
		}

		// 当前模块中没有依赖
		if (sortedDependencies.length === 0) {
			callback();
			return;
		}

		// This is nested so we need to allow one additional task
		this.processDependenciesQueue.increaseParallelism();

		asyncLib.forEach(
			sortedDependencies,
			(item, callback) => {
				this.handleModuleCreation(item, err => {
					// In V8, the Error objects keep a reference to the functions on the stack. These warnings &
					// errors are created inside closures that keep a reference to the Compilation, so errors are
					// leaking the Compilation object.
					if (err && this.bail) {
						// eslint-disable-next-line no-self-assign
						err.stack = err.stack;
						return callback(err);
					}
					callback();
				});
			},
			err => {
				this.processDependenciesQueue.decreaseParallelism();

				return callback(err);
			}
		);
	}

	/**
	 * 处理整个模块的创建过程
	 * 创建模块 => 添加模块 => 构建模块 => 递归解析模块中依赖和异步模块
	 * 1. 利用 模块工厂创建模块的方法(moduleFactory.create) 创建 Module 的实例
	 * 2. 添加模块时 缓存当前模块
	 * 3. 调用 模块的构建方法(module.build) 来构建模块
	 * 4. 递归解析模块中依赖(Dependencies)和异步模块(Blocks)
	 */
	handleModuleCreation(
		{
			factory,
			dependencies,
			originModule,
			contextInfo,
			context,
			recursive = true,
			connectOrigin = recursive
		},
		callback
	) {
		const moduleGraph = this.moduleGraph;

		// 
		const currentProfile = this.profile ? new ModuleProfile() : undefined;

		// 1. NormalModuleFactory获取创建NormalModule需要的参数(loaders...) 并创建NormalModule
		this.factorizeModule(
			{
				currentProfile,
				factory,
				dependencies,
				originModule,
				contextInfo,
				context
			},
			(err, newModule) => {
				if (err) {
					if (dependencies.every(d => d.optional)) {
						this.warnings.push(err);
					} else {
						this.errors.push(err);
					}
					return callback(err);
				}

				if (!newModule) {
					return callback();
				}

				if (currentProfile !== undefined) {
					moduleGraph.setProfile(newModule, currentProfile);
				}

				// 2. 根据不同的缓存策略 缓存Module
				this.addModule(newModule, (err, module) => {
					if (err) {
						if (!err.module) {
							err.module = module;
						}
						this.errors.push(err);

						return callback(err);
					}

					/**
					 * 构建当前模块的引用关系
					 * 1. 构建 Module 与 Dependency 的引用关系
					 * 2. 构建 Module 与 父Module 的引用关系
					 */
					for (let i = 0; i < dependencies.length; i++) {
						const dependency = dependencies[i];
						moduleGraph.setResolvedModule(
							connectOrigin ? originModule : null,
							dependency,
							module
						);
					}

					// 设置 ModuleGraphModule.issuer = originModule
					moduleGraph.setIssuerIfUnset(
						module,
						originModule !== undefined ? originModule : null
					);

					if (module !== newModule) {
						if (currentProfile !== undefined) {
							const otherProfile = moduleGraph.getProfile(module);
							if (otherProfile !== undefined) {
								currentProfile.mergeInto(otherProfile);
							} else {
								moduleGraph.setProfile(module, currentProfile);
							}
						}
					}

					// 检查是否存在循环依赖
					let creatingModuleDuringBuildSet = undefined;
					if (!recursive && this.buildQueue.isProcessing(originModule)) {
						// Track build dependency
						creatingModuleDuringBuildSet =
							this.creatingModuleDuringBuild.get(originModule);
						if (creatingModuleDuringBuildSet === undefined) {
							creatingModuleDuringBuildSet = new Set();
							this.creatingModuleDuringBuild.set(
								originModule,
								creatingModuleDuringBuildSet
							);
						}
						creatingModuleDuringBuildSet.add(originModule);

						// When building is blocked by another module
						// search for a cycle, cancel the cycle by throwing
						// an error (otherwise this would deadlock)
						const blockReasons = this.creatingModuleDuringBuild.get(module);
						if (blockReasons !== undefined) {
							const set = new Set(blockReasons);
							for (const item of set) {
								const blockReasons = this.creatingModuleDuringBuild.get(item);
								if (blockReasons !== undefined) {
									for (const m of blockReasons) {
										if (m === module) {
											return callback(new BuildCycleError(module));
										}
										set.add(m);
									}
								}
							}
						}
					}

					/**
					 * 构建 NormalModule
					 * 1. 运行所有的loaders 返回结果source
					 * 2. 将 source 构建成 WebpackSource类的实例
					 * 3. this.parser.parse(this._source.source) 给字段赋值 Module.dependencies Module.buildInfo Module.buildMeta
					 */
					this.buildModule(module, err => {
						if (creatingModuleDuringBuildSet !== undefined) {
							creatingModuleDuringBuildSet.delete(module);
						}
						if (err) {
							if (!err.module) {
								err.module = module;
							}
							this.errors.push(err);

							return callback(err);
						}

						if (!recursive) {
							this.processModuleDependenciesNonRecursive(module);
							callback(null, module);
							return;
						}

						// This avoids deadlocks for circular dependencies
						if (this.processDependenciesQueue.isProcessing(module)) {
							return callback();
						}

						// 4. 解析Module中的 dependenies 和 blocks
						this.processModuleDependencies(module, err => {
							if (err) {
								return callback(err);
							}
							callback(null, module);
						});
					});
				});
			}
		);
	}

	// 创建模块队列中  添加创建任务
	factorizeModule(options, callback) {
		this.factorizeQueue.add(options, callback);
	}

	// 通过调用 模块工厂创建模块的方法(normalFactory.create) 来创建对应 模块 的实例
	// 注意: 此时创建的 模块 并没有经过 词法语法分析 仅仅只是创建 Module 的实例
	// 示例: 
	// NormalModuleFactory.create() => NormalModule
	// ContextModuleFactory.create() => ContextModule
	_factorizeModule(
		{
			currentProfile,
			factory,
			dependencies,
			originModule,
			contextInfo,
			context
		},
		callback
	) {
		if (currentProfile !== undefined) {
			currentProfile.markFactoryStart();
		}
		factory.create(
			{
				contextInfo: {
					issuer: originModule ? originModule.nameForCondition() : "",
					issuerLayer: originModule ? originModule.layer : null,
					compiler: this.compiler.name,
					...contextInfo
				},
				resolveOptions: originModule ? originModule.resolveOptions : undefined,
				context: context
					? context
					: originModule
					? originModule.context
					: this.compiler.context,
				dependencies: dependencies
			},
			(err, result) => {
				if (result) {
					// TODO webpack 6: remove
					// For backward-compat
					if (result.module === undefined && result instanceof Module) {
						result = {
							module: result
						};
					}
					const { fileDependencies, contextDependencies, missingDependencies } =
						result;
					if (fileDependencies) {
						this.fileDependencies.addAll(fileDependencies);
					}
					if (contextDependencies) {
						this.contextDependencies.addAll(contextDependencies);
					}
					if (missingDependencies) {
						this.missingDependencies.addAll(missingDependencies);
					}
				}
				if (err) {
					const notFoundError = new ModuleNotFoundError(
						originModule,
						err,
						dependencies.map(d => d.loc).filter(Boolean)[0]
					);
					return callback(notFoundError);
				}
				if (!result) {
					return callback();
				}
				const newModule = result.module;
				if (!newModule) {
					return callback();
				}
				if (currentProfile !== undefined) {
					currentProfile.markFactoryEnd();
				}

				callback(null, newModule);
			}
		);
	}

	// 添加模块链
	addModuleChain(context, dependency, callback) {
		return this.addModuleTree({ context, dependency }, callback);
	}

	// 构建整个 模块树
	addModuleTree({ context, dependency, contextInfo }, callback) {
		if (
			typeof dependency !== "object" ||
			dependency === null ||
			!dependency.constructor
		) {
			return callback(
				new WebpackError("Parameter 'dependency' must be a Dependency")
			);
		}
		const Dep = /** @type {DepConstructor} */ (dependency.constructor);
		// 根据 Dependency 找到对应 ModuleFactory
		// 示例: EntryDependency => NormalModuleFactory
		const moduleFactory = this.dependencyFactories.get(Dep);
		if (!moduleFactory) {
			return callback(
				new WebpackError(
					`No dependency factory available for this dependency type: ${dependency.constructor.name}`
				)
			);
		}

		this.handleModuleCreation(
			{
				factory: moduleFactory,
				dependencies: [dependency],
				originModule: null,
				contextInfo,
				context
			},
			err => {
				if (err && this.bail) {
					callback(err);
					this.buildQueue.stop();
					this.rebuildQueue.stop();
					this.processDependenciesQueue.stop();
					this.factorizeQueue.stop();
				} else {
					callback();
				}
			}
		);
	}

	// 添加 编译入口 并开始编译
	addEntry(context, entry, optionsOrName, callback) {
		const options =
			typeof optionsOrName === "object"
				? optionsOrName
				: { name: optionsOrName };

		// entry 为 EntryDependency 的实例
		this._addEntryItem(context, entry, "dependencies", options, callback);
	}

	// 添加 编译入口 并开始编译
	// 与 模块联邦 相关 
	addInclude(context, dependency, options, callback) {
		this._addEntryItem(
			context,
			dependency,
			"includeDependencies",
			options,
			callback
		);
	}

	// 添加 单项入口
	_addEntryItem(context, entry, target, options, callback) {
		const { name } = options;
		let entryData =
			name !== undefined ? this.entries.get(name) : this.globalEntry;
		if (entryData === undefined) {
			entryData = {
				dependencies: [],
				includeDependencies: [],
				options: {
					name: undefined,
					...options
				}
			};
			entryData[target].push(entry);
			this.entries.set(name, entryData);
		} else {
			entryData[target].push(entry);
			for (const key of Object.keys(options)) {
				if (options[key] === undefined) continue;
				if (entryData.options[key] === options[key]) continue;
				if (
					Array.isArray(entryData.options[key]) &&
					Array.isArray(options[key]) &&
					arrayEquals(entryData.options[key], options[key])
				) {
					continue;
				}
				if (entryData.options[key] === undefined) {
					entryData.options[key] = options[key];
				} else {
					return callback(
						new WebpackError(
							`Conflicting entry option ${key} = ${entryData.options[key]} vs ${options[key]}`
						)
					);
				}
			}
		}

		// 空调用
		this.hooks.addEntry.call(entry, options);

		this.addModuleTree(
			{
				context,
				dependency: entry,
				contextInfo: entryData.options.layer
					? { issuerLayer: entryData.options.layer }
					: undefined
			},
			(err, module) => {
				if (err) {
					this.hooks.failedEntry.call(entry, options, err);
					return callback(err);
				}
				this.hooks.succeedEntry.call(entry, options, module);
				return callback(null, module);
			}
		);
	}

	// 向重建模块队列中 添加模块重建任务
	rebuildModule(module, callback) {
		this.rebuildQueue.add(module, callback);
	}

	// 重新构建模块
	_rebuildModule(module, callback) {
		this.hooks.rebuildModule.call(module);
		const oldDependencies = module.dependencies.slice();
		const oldBlocks = module.blocks.slice();
		module.invalidateBuild();
		this.buildQueue.invalidate(module);
		this.buildModule(module, err => {
			if (err) {
				return this.hooks.finishRebuildingModule.callAsync(module, err2 => {
					if (err2) {
						callback(
							makeWebpackError(err2, "Compilation.hooks.finishRebuildingModule")
						);
						return;
					}
					callback(err);
				});
			}

			this.processDependenciesQueue.invalidate(module);
			this.moduleGraph.unfreeze();
			this.processModuleDependencies(module, err => {
				if (err) return callback(err);
				this.removeReasonsOfDependencyBlock(module, {
					dependencies: oldDependencies,
					blocks: oldBlocks
				});
				this.hooks.finishRebuildingModule.callAsync(module, err2 => {
					if (err2) {
						callback(
							makeWebpackError(err2, "Compilation.hooks.finishRebuildingModule")
						);
						return;
					}
					callback(null, module);
				});
			});
		});
	}

	// 当 Module Graph 构建完成后 收集 Module 中的 errors 和 warnings
	finish(callback) {
		// 清除构建队列
		this.factorizeQueue.clear();
		if (this.profile) {
			this.logger.time("finish module profiles");
			const ParallelismFactorCalculator = require("./util/ParallelismFactorCalculator");
			const p = new ParallelismFactorCalculator();
			const moduleGraph = this.moduleGraph;
			const modulesWithProfiles = new Map();
			for (const module of this.modules) {
				const profile = moduleGraph.getProfile(module);
				if (!profile) continue;
				modulesWithProfiles.set(module, profile);
				p.range(
					profile.buildingStartTime,
					profile.buildingEndTime,
					f => (profile.buildingParallelismFactor = f)
				);
				p.range(
					profile.factoryStartTime,
					profile.factoryEndTime,
					f => (profile.factoryParallelismFactor = f)
				);
				p.range(
					profile.integrationStartTime,
					profile.integrationEndTime,
					f => (profile.integrationParallelismFactor = f)
				);
				p.range(
					profile.storingStartTime,
					profile.storingEndTime,
					f => (profile.storingParallelismFactor = f)
				);
				p.range(
					profile.restoringStartTime,
					profile.restoringEndTime,
					f => (profile.restoringParallelismFactor = f)
				);
				if (profile.additionalFactoryTimes) {
					for (const { start, end } of profile.additionalFactoryTimes) {
						const influence = (end - start) / profile.additionalFactories;
						p.range(
							start,
							end,
							f =>
								(profile.additionalFactoriesParallelismFactor += f * influence)
						);
					}
				}
			}
			p.calculate();

			const logger = this.getLogger("webpack.Compilation.ModuleProfile");
			const logByValue = (value, msg) => {
				if (value > 1000) {
					logger.error(msg);
				} else if (value > 500) {
					logger.warn(msg);
				} else if (value > 200) {
					logger.info(msg);
				} else if (value > 30) {
					logger.log(msg);
				} else {
					logger.debug(msg);
				}
			};
			const logNormalSummary = (category, getDuration, getParallelism) => {
				let sum = 0;
				let max = 0;
				for (const [module, profile] of modulesWithProfiles) {
					const p = getParallelism(profile);
					const d = getDuration(profile);
					if (d === 0 || p === 0) continue;
					const t = d / p;
					sum += t;
					if (t <= 10) continue;
					logByValue(
						t,
						` | ${Math.round(t)} ms${
							p >= 1.1 ? ` (parallelism ${Math.round(p * 10) / 10})` : ""
						} ${category} > ${module.readableIdentifier(this.requestShortener)}`
					);
					max = Math.max(max, t);
				}
				if (sum <= 10) return;
				logByValue(
					Math.max(sum / 10, max),
					`${Math.round(sum)} ms ${category}`
				);
			};
			const logByLoadersSummary = (category, getDuration, getParallelism) => {
				const map = new Map();
				for (const [module, profile] of modulesWithProfiles) {
					const list = provide(
						map,
						module.type + "!" + module.identifier().replace(/(!|^)[^!]*$/, ""),
						() => []
					);
					list.push({ module, profile });
				}

				let sum = 0;
				let max = 0;
				for (const [key, modules] of map) {
					let innerSum = 0;
					let innerMax = 0;
					for (const { module, profile } of modules) {
						const p = getParallelism(profile);
						const d = getDuration(profile);
						if (d === 0 || p === 0) continue;
						const t = d / p;
						innerSum += t;
						if (t <= 10) continue;
						logByValue(
							t,
							` |  | ${Math.round(t)} ms${
								p >= 1.1 ? ` (parallelism ${Math.round(p * 10) / 10})` : ""
							} ${category} > ${module.readableIdentifier(
								this.requestShortener
							)}`
						);
						innerMax = Math.max(innerMax, t);
					}
					sum += innerSum;
					if (innerSum <= 10) continue;
					const idx = key.indexOf("!");
					const loaders = key.slice(idx + 1);
					const moduleType = key.slice(0, idx);
					const t = Math.max(innerSum / 10, innerMax);
					logByValue(
						t,
						` | ${Math.round(innerSum)} ms ${category} > ${
							loaders
								? `${
										modules.length
								  } x ${moduleType} with ${this.requestShortener.shorten(
										loaders
								  )}`
								: `${modules.length} x ${moduleType}`
						}`
					);
					max = Math.max(max, t);
				}
				if (sum <= 10) return;
				logByValue(
					Math.max(sum / 10, max),
					`${Math.round(sum)} ms ${category}`
				);
			};
			logNormalSummary(
				"resolve to new modules",
				p => p.factory,
				p => p.factoryParallelismFactor
			);
			logNormalSummary(
				"resolve to existing modules",
				p => p.additionalFactories,
				p => p.additionalFactoriesParallelismFactor
			);
			logNormalSummary(
				"integrate modules",
				p => p.restoring,
				p => p.restoringParallelismFactor
			);
			logByLoadersSummary(
				"build modules",
				p => p.building,
				p => p.buildingParallelismFactor
			);
			logNormalSummary(
				"store modules",
				p => p.storing,
				p => p.storingParallelismFactor
			);
			logNormalSummary(
				"restore modules",
				p => p.restoring,
				p => p.restoringParallelismFactor
			);
			this.logger.timeEnd("finish module profiles");
		}
		this.logger.time("finish modules");
		const { modules } = this;

		// ResolverCachePlugin
		// InferAsyncModulesPlugin
		// FlagDependencyExportsPlugin
		this.hooks.finishModules.callAsync(modules, err => {
			this.logger.timeEnd("finish modules");
			if (err) return callback(err);

			// extract warnings and errors from modules
			this.logger.time("report dependency errors and warnings");
			this.moduleGraph.freeze();
			// 收集 Module 及 Module.dependencies 中的 errors 和 warning
			for (const module of modules) {
				// 递归收集 Module 中的 dependencies 中的 warnings 和 errors
				this.reportDependencyErrorsAndWarnings(module, [module]);

				// 收集 Module 中的 warnings 和 errors
				const errors = module.getErrors();
				if (errors !== undefined) {
					for (const error of errors) {
						if (!error.module) {
							error.module = module;
						}
						this.errors.push(error);
					}
				}
				const warnings = module.getWarnings();
				if (warnings !== undefined) {
					for (const warning of warnings) {
						if (!warning.module) {
							warning.module = module;
						}
						this.warnings.push(warning);
					}
				}
			}
			this.moduleGraph.unfreeze();
			this.logger.timeEnd("report dependency errors and warnings");

			callback();
		});
	}

	// 解除冻结
	unseal() {
		this.hooks.unseal.call();
		this.chunks.clear();
		this.chunkGroups.length = 0;
		this.namedChunks.clear();
		this.namedChunkGroups.clear();
		this.entrypoints.clear();
		this.additionalChunkAssets.length = 0;
		this.assets = {};
		this.assetsInfo.clear();
		this.moduleGraph.removeAllModuleAttributes();
		this.moduleGraph.unfreeze();
	}

	// 冻结: compilation 对象停止接收新的模块时
	seal(callback) {
		const finalCallback = err => {
			this.factorizeQueue.clear();
			this.buildQueue.clear();
			this.rebuildQueue.clear();
			this.processDependenciesQueue.clear();
			this.addModuleQueue.clear();
			return callback(err);
		};

		const chunkGraph = new ChunkGraph(this.moduleGraph);
		this.chunkGraph = chunkGraph;

		// 构建 模块 与 模块图 的映射关系
		// Module => ModuleGraph
		for (const module of this.modules) {
			ChunkGraph.setChunkGraphForModule(module, chunkGraph);
		}

		// compilation 对象停止接收新的模块时触发
		// WarnCaseSensitiveModulesPlugin(当模块路径有重复时 抛出错误)
		this.hooks.seal.call();

		this.logger.time("optimize dependencies");

		// SideEffectsFlagPlugin 插件(moduleGraph._metaMap[xx] = ids)
		// 依赖优化开始时触发
		while (this.hooks.optimizeDependencies.call(this.modules)) {
			/* empty */
		}

		// 依赖优化之后触发
		// WebAssemblyModulesPlugin
		this.hooks.afterOptimizeDependencies.call(this.modules);

		this.logger.timeEnd("optimize dependencies");

		this.logger.time("create chunks");

		/**
		 * 分块的过程:
		 * 1. 根据 Webpack.options.Entry 来创建对应的 Chunk 与 ChunkGroup
		 * 2. 根据 Webpack.options.Entry.dependOn 来绑定 ChunkGroup 的嵌套关系
		 * 3. 根据 Webpack.options.Entry.runtime 来绑定 ChunkGroup._runtimeChunk
		 */

		// 分块开始
		// 空调用
		this.hooks.beforeChunks.call();
		// 模块图 冻结
		this.moduleGraph.freeze();
		
		// Map<Entrypoint, Module[]>
		const chunkGraphInit = new Map();
		// 根据 Webpack.options.Entry 创建 Chunk 和 ChunkGroup
		// 绑定 Chunk 与 ChunkGroup 关联关系
		for (const [name, { dependencies, includeDependencies, options }] of this
			.entries) {
			const chunk = this.addChunk(name);
			if (options.filename) {
				chunk.filenameTemplate = options.filename;
			}
			const entrypoint = new Entrypoint(options);
			if (!options.dependOn && !options.runtime) {
				entrypoint.setRuntimeChunk(chunk);
			}
			entrypoint.setEntrypointChunk(chunk);
			this.namedChunkGroups.set(name, entrypoint);
			this.entrypoints.set(name, entrypoint);
			this.chunkGroups.push(entrypoint);

			// 绑定 ChunkGroup 与 Chunk 的关联关系
			// 即: chunkGroup.chunks.push(chunk)
			// 		 chunk._groups.push(entrypoint)
			connectChunkGroupAndChunk(entrypoint, chunk);

			for (const dep of [...this.globalEntry.dependencies, ...dependencies]) {
				entrypoint.addOrigin(null, { name }, /** @type {any} */ (dep).request);

				const module = this.moduleGraph.getModule(dep);
				if (module) {
					/**
					 * 绑定 Module 与 Chunk 的关联关系
					 * Module => ChunkGraphModule
					 * Chunk => ChunkGraphChunk
					 */
					chunkGraph.connectChunkAndEntryModule(chunk, module, entrypoint);
					this.assignDepth(module);
					const modulesList = chunkGraphInit.get(entrypoint);
					if (modulesList === undefined) {
						chunkGraphInit.set(entrypoint, [module]);
					} else {
						modulesList.push(module);
					}
				}
			}

			const mapAndSort = deps =>
				deps
					.map(dep => this.moduleGraph.getModule(dep))
					.filter(Boolean)
					.sort(compareModulesByIdentifier);
			const includedModules = [
				...mapAndSort(this.globalEntry.includeDependencies),
				...mapAndSort(includeDependencies)
			];

			let modulesList = chunkGraphInit.get(entrypoint);
			if (modulesList === undefined) {
				chunkGraphInit.set(entrypoint, (modulesList = []));
			}
			for (const module of includedModules) {
				this.assignDepth(module);
				modulesList.push(module);
			}
		}

		// 解析 Webpack.options.Entry.dependOn 和 Webpack.options.Entry.runtime 字段
		// 根据 Webpack.options.Entry.runtime 来绑定 ChunkGroup._runtimeChunk
		// 根据 Wepback.Config.Entry.dependOn 来绑定 ChunkGroup 的嵌套关系
		const runtimeChunks = new Set();
		outer: for (const [
			name,
			{
				options: { dependOn, runtime }
			}
		] of this.entries) {
			// webpack.Config.Entry.dependOn 和 Webpack.options.Entry.runtime 不允许同时出现
			if (dependOn && runtime) {
				const err =
					new WebpackError(`Entrypoint '${name}' has 'dependOn' and 'runtime' specified. This is not valid.
Entrypoints that depend on other entrypoints do not have their own runtime.
They will use the runtime(s) from referenced entrypoints instead.
Remove the 'runtime' option from the entrypoint.`);
				const entry = this.entrypoints.get(name);
				err.chunk = entry.getEntrypointChunk();
				this.errors.push(err);
			}
			if (dependOn) {
				const entry = this.entrypoints.get(name);
				const referencedChunks = entry
					.getEntrypointChunk()
					.getAllReferencedChunks();
				const dependOnEntries = [];
				for (const dep of dependOn) {
					const dependency = this.entrypoints.get(dep);
					if (!dependency) {
						throw new Error(
							`Entry ${name} depends on ${dep}, but this entry was not found`
						);
					}
					if (referencedChunks.has(dependency.getEntrypointChunk())) {
						const err = new WebpackError(
							`Entrypoints '${name}' and '${dep}' use 'dependOn' to depend on each other in a circular way.`
						);
						const entryChunk = entry.getEntrypointChunk();
						err.chunk = entryChunk;
						this.errors.push(err);
						entry.setRuntimeChunk(entryChunk);
						continue outer;
					}
					dependOnEntries.push(dependency);
				}
				// 构建 ChunkGroup 的嵌套关系
				for (const dependency of dependOnEntries) {
					connectChunkGroupParentAndChild(dependency, entry);
				}
			} else if (runtime) {
				const entry = this.entrypoints.get(name);
				let chunk = this.namedChunks.get(runtime);
				if (chunk) {
					if (!runtimeChunks.has(chunk)) {
						const err =
							new WebpackError(`Entrypoint '${name}' has a 'runtime' option which points to another entrypoint named '${runtime}'.
It's not valid to use other entrypoints as runtime chunk.
Did you mean to use 'dependOn: ${JSON.stringify(
								runtime
							)}' instead to allow using entrypoint '${name}' within the runtime of entrypoint '${runtime}'? For this '${runtime}' must always be loaded when '${name}' is used.
Or do you want to use the entrypoints '${name}' and '${runtime}' independently on the same page with a shared runtime? In this case give them both the same value for the 'runtime' option. It must be a name not already used by an entrypoint.`);
						const entryChunk = entry.getEntrypointChunk();
						err.chunk = entryChunk;
						this.errors.push(err);
						entry.setRuntimeChunk(entryChunk);
						continue;
					}
				} else {
					chunk = this.addChunk(runtime);
					chunk.preventIntegration = true;
					runtimeChunks.add(chunk);
				}
				entry.unshiftChunk(chunk);
				chunk.addGroup(entry);
				entry.setRuntimeChunk(chunk);
			}
		}

		// 根据 ModuleGraph 和 Chunk 构建 ChunkGraph
		// 即: 构建 Chunk 与 Module 的关联关系
		buildChunkGraph(this, chunkGraphInit);

		// 空调用
		this.hooks.afterChunks.call(this.chunks);
		// 分块结束

		this.logger.timeEnd("create chunks");
		this.logger.time("optimize");

		// 优化开始
		// 空调用
		// 优化阶段开始时触发
		this.hooks.optimize.call();

		// 空调用
		// 在模块优化阶段开始时调用
		while (this.hooks.optimizeModules.call(this.modules)) {
			/* empty */
		}

		// 空调用
		// 在模块优化完成之后调用
		this.hooks.afterOptimizeModules.call(this.modules);

		// 串行调用插件
		// 1. EnsureChunkConditionsPlugin
		// 针对于ExternalModule FallbackModule模块
		// 2. RemoveEmptyChunksPlugin
		// 移除空的chunk
		// 此chunk没有modules && 此chunk不是runtime chunk && 此chunk没有entry modules
		// 3. MergeDuplicateChunksPlugin
		// 4. SplitChunksPlugin
		// 5. RemoveEmptyChunksPlugin
		// 在 chunk 优化阶段开始时调用
		while (this.hooks.optimizeChunks.call(this.chunks, this.chunkGroups)) {
			/* empty */
		}

		// 空调用
		// chunk 优化完成之后触发
		this.hooks.afterOptimizeChunks.call(this.chunks, this.chunkGroups);

		// 直接执行回调
		// 在优化依赖树(DependencyTree)之前调用
		this.hooks.optimizeTree.callAsync(this.chunks, this.modules, err => {
			if (err) {
				return finalCallback(
					makeWebpackError(err, "Compilation.hooks.optimizeTree")
				);
			}

			// 空调用
			// 在 依赖树 优化成功完成之后调用
			this.hooks.afterOptimizeTree.call(this.chunks, this.modules);

			// 直接执行回调
			// 在 依赖树 优化之后，块模块 优化开始时调用
			this.hooks.optimizeChunkModules.callAsync(
				this.chunks,
				this.modules,
				err => {
					if (err) {
						return finalCallback(
							makeWebpackError(err, "Compilation.hooks.optimizeChunkModules")
						);
					}

					// 空调用
					// 在 chunk 模块优化成功完成之后调用
					this.hooks.afterOptimizeChunkModules.call(this.chunks, this.modules);

					// 空调用
					// 调用来决定是否存储 record
					const shouldRecord = this.hooks.shouldRecord.call() !== false;

					// 从 记录 中读取缓存的 模块 信息并给对应的 模块 设置 Id
					// RecordIdsPlugin
					// 根据 compilation.records.modules 设置 chunkGraphModule.id
					this.hooks.reviveModules.call(this.modules, this.records);

					// 空调用
					// 在为每个模块分配 id 之前执行
					this.hooks.beforeModuleIds.call(this.modules);

					// NamedModuleIdsPlugin
					// 遍历所有的模块 给每一个 模块 设置Id
					// 根据 compilation.modules 设置 compilation.records.modules
					// 同时设置 chunkGraphModule.id
					this.hooks.moduleIds.call(this.modules);

					// 空调用
					// 在模块 id 优化开始时调用
					this.hooks.optimizeModuleIds.call(this.modules);

					// 空调用
					// 在模块 id 优化完成时调用
					this.hooks.afterOptimizeModuleIds.call(this.modules);

					// 从 记录 中读取缓存的 块 信息并给对应的 块 设置 Id
					// RecordIdsPlugin
					// 根据 compilation.records.chunks 设置chunk.id chunk.ids
					this.hooks.reviveChunks.call(this.chunks, this.records);

					// 空调用
					// 在为每个 chunk 分配 id 之前执行
					this.hooks.beforeChunkIds.call(this.chunks);

					// NamedChunkIdsPlugin
					// 调用时，会为每个 chunk 分配一个 id
					this.hooks.chunkIds.call(this.chunks);

					// 空调用
					// 在 chunk id 优化阶段开始时调用
					this.hooks.optimizeChunkIds.call(this.chunks);

					// 空调用
					// chunk id 优化结束之后触发
					this.hooks.afterOptimizeChunkIds.call(this.chunks);

					// 给 Entrypoint 和 AsyncEntryponit中的Runtime Chunk 分配 chunk.id
					this.assignRuntimeIds();

					// ChunkGroups.origins 排序
					// errors warnings 排序
					this.sortItemsWithChunkIds();

					// 将当前 编译过程 中的 所有模块和块的Id信息 存储到 编译器的记录(compiler.records) 中
					if (shouldRecord) {
						// RecordIdsPlugin
						// 将compilation.modules信息存储到compilation.records.modules
						this.hooks.recordModules.call(this.modules, this.records);
						// RecordIdsPlugin
						// 将compilation.chunks信息存储到compilation.records.chunks
						this.hooks.recordChunks.call(this.chunks, this.records);
					}

					// 空调用
					this.hooks.optimizeCodeGeneration.call(this.modules);

					this.logger.timeEnd("optimize");
					this.logger.time("module hashing");

					// 空调用
					// 在创建模块哈希（hash）之前
					this.hooks.beforeModuleHash.call();

					// 批量设置 模块哈希
					// 设置 chunkGraphModule.hashes
					this.createModuleHashes();

					// 空调用
					// 在创建模块哈希（hash）之后
					this.hooks.afterModuleHash.call();

					this.logger.timeEnd("module hashing");
					this.logger.time("code generation");

					// 空调用
					this.hooks.beforeCodeGeneration.call();

					// 第一次代码生成主要是 生成最终的(通过模块工厂创建的)模块代码
					// 不包含 运行时模块
					this.codeGeneration(err => {
						if (err) {
							return finalCallback(err);
						}

						// 空调用
						this.hooks.afterCodeGeneration.call();

						this.logger.timeEnd("code generation");
						this.logger.time("runtime requirements");

						// 空调用
						this.hooks.beforeRuntimeRequirements.call();

						// 处理 模块 和 块 运行时所需要的运行时变量
						this.processRuntimeRequirements();

						// 空调用
						this.hooks.afterRuntimeRequirements.call();

						this.logger.timeEnd("runtime requirements");
						this.logger.time("hashing");

						// 空调用
						// 在 compilation 添加哈希（hash）之前
						this.hooks.beforeHash.call();

						// hash
						// 获取runtime modules的代码生成任务
						const codeGenerationJobs = this.createHash();

						// 空调用
						// 在 compilation 添加哈希（hash）之后
						this.hooks.afterHash.call();

						this.logger.timeEnd("hashing");

						// 第二次代码生成主要是生成webpack内部runtime module的code
						this._runCodeGenerationJobs(codeGenerationJobs, err => {
							if (err) {
								return finalCallback(err);
							}

							if (shouldRecord) {
								this.logger.time("record hash");
								// 空调用
								this.hooks.recordHash.call(this.records);
								this.logger.timeEnd("record hash");
							}

							this.logger.time("module assets");

							// 清除上次运行时生成的assets
							this.clearAssets();

							// 空调用
							// 在创建模块 asset 之前执行
							this.hooks.beforeModuleAssets.call();

							// TODO: 
							this.createModuleAssets();

							this.logger.timeEnd("module assets");

							const cont = () => {
								this.logger.time("process assets");

								// asset 处理
								// BannerPlugin
								// HotModuleReplacementPlugin
								// SourceMapDevToolPlugin
								// RealContentHashPlugin
								this.hooks.processAssets.callAsync(this.assets, err => {
									if (err) {
										return finalCallback(
											makeWebpackError(err, "Compilation.hooks.processAssets")
										);
									}

									// 空调用
									this.hooks.afterProcessAssets.call(this.assets);

									this.logger.timeEnd("process assets");
									this.assets = soonFrozenObjectDeprecation(
										this.assets,
										"Compilation.assets",
										"DEP_WEBPACK_COMPILATION_ASSETS",
										`BREAKING CHANGE: No more changes should happen to Compilation.assets after sealing the Compilation.
	Do changes to assets earlier, e. g. in Compilation.hooks.processAssets.
	Make sure to select an appropriate stage from Compilation.PROCESS_ASSETS_STAGE_*.`
									);

									this.summarizeDependencies();
									if (shouldRecord) {
										// 空调用
										this.hooks.record.call(this, this.records);
									}

									// 空调用
									// AggressiveSplittingPlugin
									// 调用来决定 compilation 是否需要解除 seal 以引入其他文件
									if (this.hooks.needAdditionalSeal.call()) {
										this.unseal();
										return this.seal(callback);
									}

									// 直接执行回调
									return this.hooks.afterSeal.callAsync(err => {
										if (err) {
											return finalCallback(
												makeWebpackError(err, "Compilation.hooks.afterSeal")
											);
										}
										this.fileSystemInfo.logStatistics();
										finalCallback();
									});
								});
							};

							this.logger.time("create chunk assets");

							// 空调用
							// 调用以确定是否生成 chunk asset
							if (this.hooks.shouldGenerateChunkAssets.call() !== false) {

								// 空调用
								// 在创建 chunk asset 之前
								this.hooks.beforeChunkAssets.call();

								// 生成最终的块代码
								this.createChunkAssets(err => {
									this.logger.timeEnd("create chunk assets");
									if (err) {
										return finalCallback(err);
									}
									cont();
								});
							} else {
								this.logger.timeEnd("create chunk assets");
								cont();
							}
						});
					});
				}
			);
		});
	}

	// 将给定模块的错误和警告添加到编译的错误和警告中
	// 递归收集 Module 中的 dependencies 中的 warnings 和 errors
	reportDependencyErrorsAndWarnings(module, blocks) {
		for (let indexBlock = 0; indexBlock < blocks.length; indexBlock++) {
			const block = blocks[indexBlock];
			const dependencies = block.dependencies;

			for (let indexDep = 0; indexDep < dependencies.length; indexDep++) {
				const d = dependencies[indexDep];

				const warnings = d.getWarnings(this.moduleGraph);
				if (warnings) {
					for (let indexWar = 0; indexWar < warnings.length; indexWar++) {
						const w = warnings[indexWar];

						const warning = new ModuleDependencyWarning(module, w, d.loc);
						this.warnings.push(warning);
					}
				}
				const errors = d.getErrors(this.moduleGraph);
				if (errors) {
					for (let indexErr = 0; indexErr < errors.length; indexErr++) {
						const e = errors[indexErr];

						const error = new ModuleDependencyError(module, e, d.loc);
						this.errors.push(error);
					}
				}
			}

			this.reportDependencyErrorsAndWarnings(module, block.blocks);
		}
	}

	// 获取所有的 代码生成任务 队列
	codeGeneration(callback) {
		const { chunkGraph } = this;
		this.codeGenerationResults = new CodeGenerationResults();
		// 
		// Array<{module: Module, hash: string, runtime: RuntimeSpec, runtimes: RuntimeSpec[]}>
		const jobs = [];
		for (const module of this.modules) {
			const runtimes = chunkGraph.getModuleRuntimes(module);
			if (runtimes.size === 1) {
				for (const runtime of runtimes) {
					const hash = chunkGraph.getModuleHash(module, runtime);
					jobs.push({ module, hash, runtime, runtimes: [runtime] });
				}
			} else if (runtimes.size > 1) {
				/** @type {Map<string, { runtimes: RuntimeSpec[] }>} */
				const map = new Map();
				for (const runtime of runtimes) {
					const hash = chunkGraph.getModuleHash(module, runtime);
					const job = map.get(hash);
					if (job === undefined) {
						const newJob = { module, hash, runtime, runtimes: [runtime] };
						jobs.push(newJob);
						map.set(hash, newJob);
					} else {
						job.runtimes.push(runtime);
					}
				}
			}
		}

		this._runCodeGenerationJobs(jobs, callback);
	}

	// 执行所有的 代码生成任务 队列
	_runCodeGenerationJobs(jobs, callback) {
		let statModulesFromCache = 0;
		let statModulesGenerated = 0;
		const { chunkGraph, moduleGraph, dependencyTemplates, runtimeTemplate } =
			this;
		const results = this.codeGenerationResults;
		const errors = [];
		asyncLib.eachLimit(
			jobs,
			this.options.parallelism,
			({ module, hash, runtime, runtimes }, callback) => {
				this._codeGenerationModule(
					module,
					runtime,
					runtimes,
					hash,
					dependencyTemplates,
					chunkGraph,
					moduleGraph,
					runtimeTemplate,
					errors,
					results,
					(err, codeGenerated) => {
						if (codeGenerated) statModulesGenerated++;
						else statModulesFromCache++;
						callback(err);
					}
				);
			},
			err => {
				if (err) return callback(err);
				if (errors.length > 0) {
					errors.sort(
						compareSelect(err => err.module, compareModulesByIdentifier)
					);
					for (const error of errors) {
						this.errors.push(error);
					}
				}
				this.logger.log(
					`${Math.round(
						(100 * statModulesGenerated) /
							(statModulesGenerated + statModulesFromCache)
					)}% code generated (${statModulesGenerated} generated, ${statModulesFromCache} from cache)`
				);
				callback();
			}
		);
	}

	// 调用 module.codeGeneration 生成最终的模块代码 并缓存生成最终的模块代码
	_codeGenerationModule(
		module,
		runtime,
		runtimes,
		hash,
		dependencyTemplates,
		chunkGraph,
		moduleGraph,
		runtimeTemplate,
		errors,
		results,
		callback
	) {
		let codeGenerated = false;
		const cache = new MultiItemCache(
			runtimes.map(runtime =>
				this._codeGenerationCache.getItemCache(
					`${module.identifier()}|${getRuntimeKey(runtime)}`,
					`${hash}|${dependencyTemplates.getHash()}`
				)
			)
		);
		// 读取缓存
		cache.get((err, cachedResult) => {
			if (err) return callback(err);
			let result;
			if (!cachedResult) {
				try {
					codeGenerated = true;
					this.codeGeneratedModules.add(module);
					// 生成最终的模块代码
					result = module.codeGeneration({
						chunkGraph,
						moduleGraph,
						dependencyTemplates,
						runtimeTemplate,
						runtime
					});
				} catch (err) {
					errors.push(new CodeGenerationError(module, err));
					result = cachedResult = {
						sources: new Map(),
						runtimeRequirements: null
					};
				}
			} else {
				result = cachedResult;
			}
			for (const runtime of runtimes) {
				// 缓存
				results.add(module, runtime, result);
			}
			if (!cachedResult) {
				// 重新存储缓存
				cache.store(result, err => callback(err, codeGenerated));
			} else {
				callback(null, codeGenerated);
			}
		});
	}

	// 以 Set 形式返回 Entrypoints 和 AsyncEntrypoint 包含的 RuntimeChunk
	_getChunkGraphEntries() {
		// Set<Chunk>
		const treeEntries = new Set();
		for (const ep of this.entrypoints.values()) {
			const chunk = ep.getRuntimeChunk();
			if (chunk) treeEntries.add(chunk);
		}
		for (const ep of this.asyncEntrypoints) {
			const chunk = ep.getRuntimeChunk();
			if (chunk) treeEntries.add(chunk);
		}
		return treeEntries;
	}

	// 处理 模块 及 块 运行时所需要的 运行时变量(webpack 变量)
	processRuntimeRequirements({
		chunkGraph = this.chunkGraph,
		modules = this.modules,
		chunks = this.chunks,
		codeGenerationResults = this.codeGenerationResults,
		chunkGraphEntries = this._getChunkGraphEntries()
	} = {}) {
		const context = { chunkGraph, codeGenerationResults };
		const additionalModuleRuntimeRequirements =
			this.hooks.additionalModuleRuntimeRequirements;
		const runtimeRequirementInModule = this.hooks.runtimeRequirementInModule;
		for (const module of modules) {
			if (chunkGraph.getNumberOfModuleChunks(module) > 0) {
				for (const runtime of chunkGraph.getModuleRuntimes(module)) {
					let set;
					const runtimeRequirements =
						codeGenerationResults.getRuntimeRequirements(module, runtime);
					if (runtimeRequirements && runtimeRequirements.size > 0) {
						set = new Set(runtimeRequirements);
					} else if (additionalModuleRuntimeRequirements.isUsed()) {
						set = new Set();
					} else {
						continue;
					}
					additionalModuleRuntimeRequirements.call(module, set, context);

					for (const r of set) {
						const hook = runtimeRequirementInModule.get(r);
						if (hook !== undefined) hook.call(module, set, context);
					}

					// 存储 当前模块 运行时所需要的 webpack 变量
					chunkGraph.addModuleRuntimeRequirements(module, runtime, set);
				}
			}
		}

		for (const chunk of chunks) {
			const set = new Set();
			for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
				const runtimeRequirements = chunkGraph.getModuleRuntimeRequirements(
					module,
					chunk.runtime
				);
				for (const r of runtimeRequirements) set.add(r);
			}
			this.hooks.additionalChunkRuntimeRequirements.call(chunk, set, context);

			for (const r of set) {
				this.hooks.runtimeRequirementInChunk.for(r).call(chunk, set, context);
			}

			// 存储 当前块 运行时所需要的 webpack 变量
			chunkGraph.addChunkRuntimeRequirements(chunk, set);
		}

		for (const treeEntry of chunkGraphEntries) {
			const set = new Set();
			for (const chunk of treeEntry.getAllReferencedChunks()) {
				const runtimeRequirements =
					chunkGraph.getChunkRuntimeRequirements(chunk);
				for (const r of runtimeRequirements) set.add(r);
			}

			this.hooks.additionalTreeRuntimeRequirements.call(
				treeEntry,
				set,
				context
			);

			// 根据不同的 webpack 变量添加不同的运行时模块
			for (const r of set) {
				this.hooks.runtimeRequirementInTree
					.for(r)
					.call(treeEntry, set, context);
			}

			chunkGraph.addTreeRuntimeRequirements(treeEntry, set);
		}
	}

	// 添加 运行时模块
	addRuntimeModule(chunk, module, chunkGraph = this.chunkGraph) {
		// Deprecated ModuleGraph association
		ModuleGraph.setModuleGraphForModule(module, this.moduleGraph);

		// add it to the list
		this.modules.add(module);
		this._modules.set(module.identifier(), module);

		// connect to the chunk graph
		chunkGraph.connectChunkAndModule(chunk, module);
		chunkGraph.connectChunkAndRuntimeModule(chunk, module);
		if (module.fullHash) {
			chunkGraph.addFullHashModuleToChunk(chunk, module);
		}

		// attach runtime module
		module.attach(this, chunk, chunkGraph);

		// Setup internals
		const exportsInfo = this.moduleGraph.getExportsInfo(module);
		exportsInfo.setHasProvideInfo();
		if (typeof chunk.runtime === "string") {
			exportsInfo.setUsedForSideEffectsOnly(chunk.runtime);
		} else if (chunk.runtime === undefined) {
			exportsInfo.setUsedForSideEffectsOnly(undefined);
		} else {
			for (const runtime of chunk.runtime) {
				exportsInfo.setUsedForSideEffectsOnly(runtime);
			}
		}
		chunkGraph.addModuleRuntimeRequirements(
			module,
			chunk.runtime,
			new Set([RuntimeGlobals.requireScope])
		);

		// 运行时模块不需要 ids
		// runtime modules don't need ids
		chunkGraph.setModuleId(module, "");

		// Call hook
		this.hooks.runtimeModule.call(module, chunk);
	}

	/**
	 * @param {string | ChunkGroupOptions} groupOptions options for the chunk group
	 * @param {Module} module the module the references the chunk group
	 * @param {DependencyLocation} loc the location from with the chunk group is referenced (inside of module)
	 * @param {string} request the request from which the the chunk group is referenced
	 * @returns {ChunkGroup} the new or existing chunk group
	 */
	addChunkInGroup(groupOptions, module, loc, request) {
		if (typeof groupOptions === "string") {
			groupOptions = { name: groupOptions };
		}
		const name = groupOptions.name;

		if (name) {
			const chunkGroup = this.namedChunkGroups.get(name);
			if (chunkGroup !== undefined) {
				chunkGroup.addOptions(groupOptions);
				if (module) {
					chunkGroup.addOrigin(module, loc, request);
				}
				return chunkGroup;
			}
		}
		const chunkGroup = new ChunkGroup(groupOptions);
		if (module) chunkGroup.addOrigin(module, loc, request);
		const chunk = this.addChunk(name);

		connectChunkGroupAndChunk(chunkGroup, chunk);

		this.chunkGroups.push(chunkGroup);
		if (name) {
			this.namedChunkGroups.set(name, chunkGroup);
		}
		return chunkGroup;
	}

	/**
	 * @param {EntryOptions} options options for the entrypoint
	 * @param {Module} module the module the references the chunk group
	 * @param {DependencyLocation} loc the location from with the chunk group is referenced (inside of module)
	 * @param {string} request the request from which the the chunk group is referenced
	 * @returns {Entrypoint} the new or existing entrypoint
	 */
	// 添加异步入口
	addAsyncEntrypoint(options, module, loc, request) {
		const name = options.name;
		if (name) {
			const entrypoint = this.namedChunkGroups.get(name);
			if (entrypoint instanceof Entrypoint) {
				if (entrypoint !== undefined) {
					if (module) {
						entrypoint.addOrigin(module, loc, request);
					}
					return entrypoint;
				}
			} else if (entrypoint) {
				throw new Error(
					`Cannot add an async entrypoint with the name '${name}', because there is already an chunk group with this name`
				);
			}
		}
		const chunk = this.addChunk(name);
		if (options.filename) {
			chunk.filenameTemplate = options.filename;
		}
		const entrypoint = new Entrypoint(options, false);
		entrypoint.setRuntimeChunk(chunk);
		entrypoint.setEntrypointChunk(chunk);
		if (name) {
			this.namedChunkGroups.set(name, entrypoint);
		}
		this.chunkGroups.push(entrypoint);
		this.asyncEntrypoints.push(entrypoint);
		connectChunkGroupAndChunk(entrypoint, chunk);
		if (module) {
			entrypoint.addOrigin(module, loc, request);
		}
		return entrypoint;
	}

	// 返回 Chunk (创建 Chunk 的实例 并缓存 Chunk)
	addChunk(name) {
		if (name) {
			const chunk = this.namedChunks.get(name);
			if (chunk !== undefined) {
				return chunk;
			}
		}
		const chunk = new Chunk(name);
		this.chunks.add(chunk);
		ChunkGraph.setChunkGraphForChunk(chunk, this.chunkGraph);
		if (name) {
			this.namedChunks.set(name, chunk);
		}
		return chunk;
	}

	// 为给定的模块及其依赖块递归分配 depth 
	// 递归设置 ModuleGraphModule.depth
	assignDepth(module) {
		const moduleGraph = this.moduleGraph;

		const queue = new Set([module]);
		let depth;

		moduleGraph.setDepth(module, 0);

		/**
		 * @param {Module} module module for processing
		 * @returns {void}
		 */
		const processModule = module => {
			if (!moduleGraph.setDepthIfLower(module, depth)) return;
			queue.add(module);
		};

		for (module of queue) {
			queue.delete(module);
			depth = moduleGraph.getDepth(module) + 1;

			for (const connection of moduleGraph.getOutgoingConnections(module)) {
				const refModule = connection.module;
				if (refModule) {
					processModule(refModule);
				}
			}
		}
	}

	// 返回给定模块对依赖的引用
	getDependencyReferencedExports(dependency, runtime) {
		const referencedExports = dependency.getReferencedExports(
			this.moduleGraph,
			runtime
		);
		return this.hooks.dependencyReferencedExports.call(
			referencedExports,
			dependency,
			runtime
		);
	}

	// 移除模块与依赖块之间的关系
	removeReasonsOfDependencyBlock(module, block) {
		if (block.blocks) {
			for (const b of block.blocks) {
				this.removeReasonsOfDependencyBlock(module, b);
			}
		}

		if (block.dependencies) {
			for (const dep of block.dependencies) {
				const originalModule = this.moduleGraph.getModule(dep);
				if (originalModule) {
					this.moduleGraph.removeConnection(dep);

					if (this.chunkGraph) {
						for (const chunk of this.chunkGraph.getModuleChunks(
							originalModule
						)) {
							this.patchChunksAfterReasonRemoval(originalModule, chunk);
						}
					}
				}
			}
		}
	}

	// 删除依赖性原因后，修补模块和 chunk 的关系
	patchChunksAfterReasonRemoval(module, chunk) {
		if (!module.hasReasons(this.moduleGraph, chunk.runtime)) {
			this.removeReasonsOfDependencyBlock(module, module);
		}
		if (!module.hasReasonForChunk(chunk, this.moduleGraph, this.chunkGraph)) {
			if (this.chunkGraph.isModuleInChunk(module, chunk)) {
				this.chunkGraph.disconnectChunkAndModule(chunk, module);
				this.removeChunkFromDependencies(module, chunk);
			}
		}
	}

	// 在除去依赖性原因后，从依赖块模块和 chunk 中移除给定的 chunk
	removeChunkFromDependencies(block, chunk) {
		/**
		 * @param {Dependency} d dependency to (maybe) patch up
		 */
		const iteratorDependency = d => {
			const depModule = this.moduleGraph.getModule(d);
			if (!depModule) {
				return;
			}
			this.patchChunksAfterReasonRemoval(depModule, chunk);
		};

		const blocks = block.blocks;
		for (let indexBlock = 0; indexBlock < blocks.length; indexBlock++) {
			const asyncBlock = blocks[indexBlock];
			const chunkGroup = this.chunkGraph.getBlockChunkGroup(asyncBlock);
			// Grab all chunks from the first Block's AsyncDepBlock
			const chunks = chunkGroup.chunks;
			// For each chunk in chunkGroup
			for (let indexChunk = 0; indexChunk < chunks.length; indexChunk++) {
				const iteratedChunk = chunks[indexChunk];
				chunkGroup.removeChunk(iteratedChunk);
				// Recurse
				this.removeChunkFromDependencies(block, iteratedChunk);
			}
		}

		if (block.dependencies) {
			for (const dep of block.dependencies) iteratorDependency(dep);
		}
	}

	// 给每个 入口点 和 异步入口点 的 运行时块 设置 块Id
	// 设置 chunkGraph._runtimeIds
	assignRuntimeIds() {
		const { chunkGraph } = this;
		const processEntrypoint = ep => {
			// 返回 当前入口点名
			const runtime = ep.options.runtime || ep.name;
			// 返回 当前入口点 的 运行时块
			const chunk = ep.getRuntimeChunk();
			// chunkGraph._runtimeIds.set(runtime, chunk.id)
			chunkGraph.setRuntimeId(runtime, chunk.id);
		};
		// 给每个 入口点 的 运行时块 分配 chunk.id
		for (const ep of this.entrypoints.values()) {
			processEntrypoint(ep);
		}
		// 给每个 异步入口点 中的 运行时块 分配 chunk.id
		for (const ep of this.asyncEntrypoints) {
			processEntrypoint(ep);
		}
	}

	// 排序
	// chunkGroups.origins 排序
	// compilation.errors 排序
	// compilation.warnings 排序
	// compilation.childaren 排序
	sortItemsWithChunkIds() {
		for (const chunkGroup of this.chunkGroups) {
			chunkGroup.sortItems();
		}

		this.errors.sort(compareErrors);
		this.warnings.sort(compareErrors);
		this.children.sort(byNameOrHash);
	}

	// 归纳所有的依赖
	summarizeDependencies() {
		for (
			let indexChildren = 0;
			indexChildren < this.children.length;
			indexChildren++
		) {
			const child = this.children[indexChildren];

			this.fileDependencies.addAll(child.fileDependencies);
			this.contextDependencies.addAll(child.contextDependencies);
			this.missingDependencies.addAll(child.missingDependencies);
			this.buildDependencies.addAll(child.buildDependencies);
		}

		for (const module of this.modules) {
			module.addCacheDependencies(
				this.fileDependencies,
				this.contextDependencies,
				this.missingDependencies,
				this.buildDependencies
			);
		}
	}

	// 批量生成 模块哈希
	createModuleHashes() {
		let statModulesHashed = 0;
		const { chunkGraph, runtimeTemplate } = this;
		const { hashFunction, hashDigest, hashDigestLength } = this.outputOptions;
		for (const module of this.modules) {
			for (const runtime of chunkGraph.getModuleRuntimes(module)) {
				statModulesHashed++;
				this._createModuleHash(
					module,
					chunkGraph,
					runtime,
					hashFunction,
					runtimeTemplate,
					hashDigest,
					hashDigestLength
				);
			}
		}
		this.logger.log(
			`${statModulesHashed} modules hashed (${
				Math.round((100 * statModulesHashed) / this.modules.size) / 100
			} variants per module in average)`
		);
	}

	// 生成单个模块哈希
	// 设置 chunkGraphModule.hashes
	_createModuleHash(
		module,
		chunkGraph,
		runtime,
		hashFunction,
		runtimeTemplate,
		hashDigest,
		hashDigestLength
	) {
		const moduleHash = createHash(hashFunction);
		module.updateHash(moduleHash, {
			chunkGraph,
			runtime,
			runtimeTemplate
		});
		const moduleHashDigest = /** @type {string} */ (
			moduleHash.digest(hashDigest)
		);
		chunkGraph.setModuleHashes(
			module,
			runtime,
			moduleHashDigest,
			moduleHashDigest.substr(0, hashDigestLength)
		);
		return moduleHashDigest;
	}

	// 生成整个 编译过程 中的完整哈希值 并返回运行时模块 代码生成任务
	createHash() {
		this.logger.time("hashing: initialize hash");
		const chunkGraph = this.chunkGraph;
		const runtimeTemplate = this.runtimeTemplate;
		const outputOptions = this.outputOptions;
		// 哈希函数
		const hashFunction = outputOptions.hashFunction;
		// 哈希编码
		const hashDigest = outputOptions.hashDigest;
		// 哈希摘要的前缀长度
		const hashDigestLength = outputOptions.hashDigestLength;
		const hash = createHash(hashFunction);
		// 哈希盐值
		if (outputOptions.hashSalt) {
			hash.update(outputOptions.hashSalt);
		}
		this.logger.timeEnd("hashing: initialize hash");
		if (this.children.length > 0) {
			this.logger.time("hashing: hash child compilations");
			for (const child of this.children) {
				hash.update(child.hash);
			}
			this.logger.timeEnd("hashing: hash child compilations");
		}
		if (this.warnings.length > 0) {
			this.logger.time("hashing: hash warnings");
			for (const warning of this.warnings) {
				hash.update(`${warning.message}`);
			}
			this.logger.timeEnd("hashing: hash warnings");
		}
		if (this.errors.length > 0) {
			this.logger.time("hashing: hash errors");
			for (const error of this.errors) {
				hash.update(`${error.message}`);
			}
			this.logger.timeEnd("hashing: hash errors");
		}

		this.logger.time("hashing: sort chunks");
		/*
		 * all non-runtime chunks need to be hashes first,
		 * since runtime chunk might use their hashes.
		 * runtime chunks need to be hashed in the correct order
		 * since they may depend on each other (for async entrypoints).
		 * So we put all non-runtime chunks first and hash them in any order.
		 * And order runtime chunks according to referenced between each other.
		 * Chunks need to be in deterministic order since we add hashes to full chunk
		 * during these hashing.
		 */
		// 包含 运行时块 的 块
		// Array<RuntimeChunk>
		const unorderedRuntimeChunks = [];
		// 不包含 运行时块 的 块
		// Array<Chunk>
		const otherChunks = [];
		for (const c of this.chunks) {
			if (c.hasRuntime()) {
				unorderedRuntimeChunks.push(c);
			} else {
				otherChunks.push(c);
			}
		}
		unorderedRuntimeChunks.sort(byId);
		otherChunks.sort(byId);

		/** @typedef {{ chunk: Chunk, referencedBy: RuntimeChunkInfo[], remaining: number }} RuntimeChunkInfo */
		/** @type {Map<Chunk, RuntimeChunkInfo>} */
		const runtimeChunksMap = new Map();
		for (const chunk of unorderedRuntimeChunks) {
			runtimeChunksMap.set(chunk, {
				chunk,
				referencedBy: [],
				remaining: 0
			});
		}
		let remaining = 0;
		for (const info of runtimeChunksMap.values()) {
			for (const other of new Set(
				// 当前块 关联的 异步入口点 下的所有块
				Array.from(info.chunk.getAllReferencedAsyncEntrypoints()).map(
					e => e.chunks[e.chunks.length - 1]
				)
			)) {
				const otherInfo = runtimeChunksMap.get(other);
				otherInfo.referencedBy.push(info);
				info.remaining++;
				remaining++;
			}
		}
		/** @type {Chunk[]} */
		const runtimeChunks = [];
		for (const info of runtimeChunksMap.values()) {
			if (info.remaining === 0) {
				runtimeChunks.push(info.chunk);
			}
		}
		// If there are any references between chunks
		// make sure to follow these chains
		if (remaining > 0) {
			const readyChunks = [];
			for (const chunk of runtimeChunks) {
				const info = runtimeChunksMap.get(chunk);
				for (const otherInfo of info.referencedBy) {
					remaining--;
					if (--otherInfo.remaining === 0) {
						readyChunks.push(otherInfo.chunk);
					}
				}
				if (readyChunks.length > 0) {
					// This ensures deterministic ordering, since referencedBy is non-deterministic
					readyChunks.sort(byId);
					for (const c of readyChunks) runtimeChunks.push(c);
					readyChunks.length = 0;
				}
			}
		}
		// If there are still remaining references we have cycles and want to create a warning
		if (remaining > 0) {
			let circularRuntimeChunkInfo = [];
			for (const info of runtimeChunksMap.values()) {
				if (info.remaining !== 0) {
					circularRuntimeChunkInfo.push(info);
				}
			}
			circularRuntimeChunkInfo.sort(compareSelect(i => i.chunk, byId));
			const err =
				new WebpackError(`Circular dependency between chunks with runtime (${Array.from(
					circularRuntimeChunkInfo,
					c => c.chunk.name || c.chunk.id
				).join(", ")})
This prevents using hashes of each other and should be avoided.`);
			err.chunk = circularRuntimeChunkInfo[0].chunk;
			this.warnings.push(err);
			for (const i of circularRuntimeChunkInfo) runtimeChunks.push(i.chunk);
		}
		this.logger.timeEnd("hashing: sort chunks");

		const fullHashChunks = new Set();
		/** @type {{module: Module, hash: string, runtime: RuntimeSpec, runtimes: RuntimeSpec[]}[]} */
		const codeGenerationJobs = [];
		/** @type {Map<string, Map<Module, {module: Module, hash: string, runtime: RuntimeSpec, runtimes: RuntimeSpec[]}>>} */
		const codeGenerationJobsMap = new Map();

		const processChunk = chunk => {
			// Last minute module hash generation for modules that depend on chunk hashes
			this.logger.time("hashing: hash runtime modules");
			const runtime = chunk.runtime;
			for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
				if (!chunkGraph.hasModuleHashes(module, runtime)) {
					const hash = this._createModuleHash(
						module,
						chunkGraph,
						runtime,
						hashFunction,
						runtimeTemplate,
						hashDigest,
						hashDigestLength
					);
					let hashMap = codeGenerationJobsMap.get(hash);
					if (hashMap) {
						const moduleJob = hashMap.get(module);
						if (moduleJob) {
							moduleJob.runtimes.push(runtime);
							continue;
						}
					} else {
						hashMap = new Map();
						codeGenerationJobsMap.set(hash, hashMap);
					}
					const job = {
						module,
						hash,
						runtime,
						runtimes: [runtime]
					};
					hashMap.set(module, job);
					codeGenerationJobs.push(job);
				}
			}
			this.logger.timeAggregate("hashing: hash runtime modules");
			this.logger.time("hashing: hash chunks");
			const chunkHash = createHash(hashFunction);
			try {
				if (outputOptions.hashSalt) {
					chunkHash.update(outputOptions.hashSalt);
				}
				chunk.updateHash(chunkHash, chunkGraph);
				//
				this.hooks.chunkHash.call(chunk, chunkHash, {
					chunkGraph,
					moduleGraph: this.moduleGraph,
					runtimeTemplate: this.runtimeTemplate
				});
				const chunkHashDigest = /** @type {string} */ (
					chunkHash.digest(hashDigest)
				);
				hash.update(chunkHashDigest);
				chunk.hash = chunkHashDigest;
				chunk.renderedHash = chunk.hash.substr(0, hashDigestLength);
				const fullHashModules =
					chunkGraph.getChunkFullHashModulesIterable(chunk);
				if (fullHashModules) {
					fullHashChunks.add(chunk);
				} else {
					this.hooks.contentHash.call(chunk);
				}
			} catch (err) {
				this.errors.push(new ChunkRenderError(chunk, "", err));
			}
			this.logger.timeAggregate("hashing: hash chunks");
		};
		otherChunks.forEach(processChunk);
		for (const chunk of runtimeChunks) processChunk(chunk);

		this.logger.timeAggregateEnd("hashing: hash runtime modules");
		this.logger.timeAggregateEnd("hashing: hash chunks");
		this.logger.time("hashing: hash digest");
		this.hooks.fullHash.call(hash);
		// 当前 编译过程 中的 完整哈希值
		this.fullHash = /** @type {string} */ (hash.digest(hashDigest));
		// 当前 编译过程 中的 完整哈希值(截取特定长度)
		this.hash = this.fullHash.substr(0, hashDigestLength);
		this.logger.timeEnd("hashing: hash digest");

		this.logger.time("hashing: process full hash modules");
		for (const chunk of fullHashChunks) {
			for (const module of chunkGraph.getChunkFullHashModulesIterable(chunk)) {
				const moduleHash = createHash(hashFunction);
				module.updateHash(moduleHash, {
					chunkGraph,
					runtime: chunk.runtime,
					runtimeTemplate
				});
				const moduleHashDigest = /** @type {string} */ (
					moduleHash.digest(hashDigest)
				);
				const oldHash = chunkGraph.getModuleHash(module, chunk.runtime);
				chunkGraph.setModuleHashes(
					module,
					chunk.runtime,
					moduleHashDigest,
					moduleHashDigest.substr(0, hashDigestLength)
				);
				codeGenerationJobsMap.get(oldHash).get(module).hash = moduleHashDigest;
			}
			const chunkHash = createHash(hashFunction);
			chunkHash.update(chunk.hash);
			chunkHash.update(this.hash);
			const chunkHashDigest = /** @type {string} */ (
				chunkHash.digest(hashDigest)
			);
			chunk.hash = chunkHashDigest;
			chunk.renderedHash = chunk.hash.substr(0, hashDigestLength);
			// 内容哈希
			this.hooks.contentHash.call(chunk);
		}
		this.logger.timeEnd("hashing: process full hash modules");
		return codeGenerationJobs;
	}

	// 存储本次构建生成的构建资源
	emitAsset(file, source, assetInfo = {}) { 
		if (this.assets[file]) {
			if (!isSourceEqual(this.assets[file], source)) {
				this.errors.push(
					new WebpackError(
						`Conflict: Multiple assets emit different content to the same filename ${file}`
					)
				);
				this.assets[file] = source;
				this._setAssetInfo(file, assetInfo);
				return;
			}
			const oldInfo = this.assetsInfo.get(file);
			const newInfo = Object.assign({}, oldInfo, assetInfo);
			this._setAssetInfo(file, newInfo, oldInfo);
			return;
		}
		this.assets[file] = source;
		this._setAssetInfo(file, assetInfo, undefined);
	}

	// 设置 构建资源信息
	_setAssetInfo(file, newInfo, oldInfo = this.assetsInfo.get(file)) {
		if (newInfo === undefined) {
			this.assetsInfo.delete(file);
		} else {
			this.assetsInfo.set(file, newInfo);
		}
		const oldRelated = oldInfo && oldInfo.related;
		const newRelated = newInfo && newInfo.related;
		if (oldRelated) {
			for (const key of Object.keys(oldRelated)) {
				const remove = name => {
					const relatedIn = this._assetsRelatedIn.get(name);
					if (relatedIn === undefined) return;
					const entry = relatedIn.get(key);
					if (entry === undefined) return;
					entry.delete(file);
					if (entry.size !== 0) return;
					relatedIn.delete(key);
					if (relatedIn.size === 0) this._assetsRelatedIn.delete(name);
				};
				const entry = oldRelated[key];
				if (Array.isArray(entry)) {
					entry.forEach(remove);
				} else if (entry) {
					remove(entry);
				}
			}
		}
		if (newRelated) {
			for (const key of Object.keys(newRelated)) {
				const add = name => {
					let relatedIn = this._assetsRelatedIn.get(name);
					if (relatedIn === undefined) {
						this._assetsRelatedIn.set(name, (relatedIn = new Map()));
					}
					let entry = relatedIn.get(key);
					if (entry === undefined) {
						relatedIn.set(key, (entry = new Set()));
					}
					entry.add(file);
				};
				const entry = newRelated[key];
				if (Array.isArray(entry)) {
					entry.forEach(add);
				} else if (entry) {
					add(entry);
				}
			}
		}
	}

	// 更新 构建资源
	updateAsset(
		file,
		newSourceOrFunction,
		assetInfoUpdateOrFunction = undefined
	) {
		if (!this.assets[file]) {
			throw new Error(
				`Called Compilation.updateAsset for not existing filename ${file}`
			);
		}
		if (typeof newSourceOrFunction === "function") {
			this.assets[file] = newSourceOrFunction(this.assets[file]);
		} else {
			this.assets[file] = newSourceOrFunction;
		}
		if (assetInfoUpdateOrFunction !== undefined) {
			const oldInfo = this.assetsInfo.get(file) || EMPTY_ASSET_INFO;
			if (typeof assetInfoUpdateOrFunction === "function") {
				this._setAssetInfo(file, assetInfoUpdateOrFunction(oldInfo), oldInfo);
			} else {
				this._setAssetInfo(
					file,
					cachedCleverMerge(oldInfo, assetInfoUpdateOrFunction),
					oldInfo
				);
			}
		}
	}

	// 重命名 构建资源
	renameAsset(file, newFile) {
		const source = this.assets[file];
		if (!source) {
			throw new Error(
				`Called Compilation.renameAsset for not existing filename ${file}`
			);
		}
		if (this.assets[newFile]) {
			if (!isSourceEqual(this.assets[file], source)) {
				this.errors.push(
					new WebpackError(
						`Conflict: Called Compilation.renameAsset for already existing filename ${newFile} with different content`
					)
				);
			}
		}
		const assetInfo = this.assetsInfo.get(file);
		// Update related in all other assets
		const relatedInInfo = this._assetsRelatedIn.get(file);
		if (relatedInInfo) {
			for (const [key, assets] of relatedInInfo) {
				for (const name of assets) {
					const info = this.assetsInfo.get(name);
					if (!info) continue;
					const related = info.related;
					if (!related) continue;
					const entry = related[key];
					let newEntry;
					if (Array.isArray(entry)) {
						newEntry = entry.map(x => (x === file ? newFile : x));
					} else if (entry === file) {
						newEntry = newFile;
					} else continue;
					this.assetsInfo.set(name, {
						...info,
						related: {
							...related,
							[key]: newEntry
						}
					});
				}
			}
		}
		this._setAssetInfo(file, undefined, assetInfo);
		this._setAssetInfo(newFile, assetInfo);
		delete this.assets[file];
		this.assets[newFile] = source;
		for (const chunk of this.chunks) {
			{
				const size = chunk.files.size;
				chunk.files.delete(file);
				if (size !== chunk.files.size) {
					chunk.files.add(newFile);
				}
			}
			{
				const size = chunk.auxiliaryFiles.size;
				chunk.auxiliaryFiles.delete(file);
				if (size !== chunk.auxiliaryFiles.size) {
					chunk.auxiliaryFiles.add(newFile);
				}
			}
		}
	}

	// 根据 标识 删除对应的构建资源
	deleteAsset(file) {
		if (!this.assets[file]) {
			return;
		}
		delete this.assets[file];
		const assetInfo = this.assetsInfo.get(file);
		this._setAssetInfo(file, undefined, assetInfo);
		const related = assetInfo && assetInfo.related;
		if (related) {
			for (const key of Object.keys(related)) {
				const checkUsedAndDelete = file => {
					if (!this._assetsRelatedIn.has(file)) {
						this.deleteAsset(file);
					}
				};
				const items = related[key];
				if (Array.isArray(items)) {
					items.forEach(checkUsedAndDelete);
				} else if (items) {
					checkUsedAndDelete(items);
				}
			}
		}
		// TODO If this becomes a performance problem
		// store a reverse mapping from asset to chunk
		for (const chunk of this.chunks) {
			chunk.files.delete(file);
			chunk.auxiliaryFiles.delete(file);
		}
	}

	// 返回所有的构建资源
	getAssets() {
		const array = [];
		for (const assetName of Object.keys(this.assets)) {
			if (Object.prototype.hasOwnProperty.call(this.assets, assetName)) {
				array.push({
					name: assetName,
					source: this.assets[assetName],
					info: this.assetsInfo.get(assetName) || EMPTY_ASSET_INFO
				});
			}
		}
		return array;
	}

	// 根据 标识 返回对应的构建资源
	getAsset(name) {
		if (!Object.prototype.hasOwnProperty.call(this.assets, name))
			return undefined;
		return {
			name,
			source: this.assets[name],
			info: this.assetsInfo.get(name) || EMPTY_ASSET_INFO
		};
	}

	// 清除上次构建缓存的构建资源
	clearAssets() {
		for (const chunk of this.chunks) {
			chunk.files.clear();
			chunk.auxiliaryFiles.clear();
		}
	}

	// 创建 模块资源文件
	// 从缓存的 模块打包信息(module.buildInfo.assetsInfo) 中读取生成的代码
	createModuleAssets() {
		const { chunkGraph } = this;
		for (const module of this.modules) {
			if (module.buildInfo.assets) {
				const assetsInfo = module.buildInfo.assetsInfo;
				for (const assetName of Object.keys(module.buildInfo.assets)) {
					const fileName = this.getPath(assetName, {
						chunkGraph: this.chunkGraph,
						module
					});
					for (const chunk of chunkGraph.getModuleChunksIterable(module)) {
						chunk.auxiliaryFiles.add(fileName);
					}
					this.emitAsset(
						fileName,
						module.buildInfo.assets[assetName],
						assetsInfo ? assetsInfo.get(assetName) : undefined
					);
					// 空调用
					this.hooks.moduleAsset.call(module, fileName);
				}
			}
		}
	}

	// 返回 渲染块 的方法
	getRenderManifest(options) {
		// 插件
		// JavascriptModulesPlugin  获得render函数
		// AssetModulesPlugin
		return this.hooks.renderManifest.call([], options);
	}

	// 创建 块资源文件
	// render chunk
	// 根据chunks来生成compilation.assets
	createChunkAssets(callback) {
		const outputOptions = this.outputOptions;
		const cachedSourceMap = new WeakMap();
		// Map<string, {hash: string, source: Source, chunk: Chunk}>
		const alreadyWrittenFiles = new Map();

		asyncLib.forEach(
			this.chunks,
			(chunk, callback) => {
				/** @type {RenderManifestEntry[]} */
				let manifest;
				try {
					// 获取 渲染块 的方法
					manifest = this.getRenderManifest({
						chunk,
						hash: this.hash,
						fullHash: this.fullHash,
						outputOptions,
						codeGenerationResults: this.codeGenerationResults,
						moduleTemplates: this.moduleTemplates,
						dependencyTemplates: this.dependencyTemplates,
						chunkGraph: this.chunkGraph,
						moduleGraph: this.moduleGraph,
						runtimeTemplate: this.runtimeTemplate
					});
				} catch (err) {
					this.errors.push(new ChunkRenderError(chunk, "", err));
					return callback();
				}
				asyncLib.forEach(
					manifest,
					(fileManifest, callback) => {
						const ident = fileManifest.identifier;
						const usedHash = fileManifest.hash;

						const assetCacheItem = this._assetsCache.getItemCache(
							ident,
							usedHash
						);

						assetCacheItem.get((err, sourceFromCache) => {
							/** @type {string | function(PathData, AssetInfo=): string} */
							let filenameTemplate;
							/** @type {string} */
							let file;
							/** @type {AssetInfo} */
							let assetInfo;

							let inTry = true;
							const errorAndCallback = err => {
								const filename =
									file ||
									(typeof file === "string"
										? file
										: typeof filenameTemplate === "string"
										? filenameTemplate
										: "");

								this.errors.push(new ChunkRenderError(chunk, filename, err));
								inTry = false;
								return callback();
							};

							try {
								if ("filename" in fileManifest) {
									file = fileManifest.filename;
									assetInfo = fileManifest.info;
								} else {
									filenameTemplate = fileManifest.filenameTemplate;
									const pathAndInfo = this.getPathWithInfo(
										filenameTemplate,
										fileManifest.pathOptions
									);
									file = pathAndInfo.path;
									assetInfo = fileManifest.info
										? {
												...pathAndInfo.info,
												...fileManifest.info
										  }
										: pathAndInfo.info;
								}

								if (err) {
									return errorAndCallback(err);
								}

								let source = sourceFromCache;

								// check if the same filename was already written by another chunk
								const alreadyWritten = alreadyWrittenFiles.get(file);
								if (alreadyWritten !== undefined) {
									if (alreadyWritten.hash !== usedHash) {
										inTry = false;
										return callback(
											new WebpackError(
												`Conflict: Multiple chunks emit assets to the same filename ${file}` +
													` (chunks ${alreadyWritten.chunk.id} and ${chunk.id})`
											)
										);
									} else {
										source = alreadyWritten.source;
									}
								} else if (!source) {
									// 渲染块
									source = fileManifest.render();

									// Ensure that source is a cached source to avoid additional cost because of repeated access
									if (!(source instanceof CachedSource)) {
										const cacheEntry = cachedSourceMap.get(source);
										if (cacheEntry) {
											source = cacheEntry;
										} else {
											const cachedSource = new CachedSource(source);
											cachedSourceMap.set(source, cachedSource);
											source = cachedSource;
										}
									}
								}
								this.emitAsset(file, source, assetInfo);
								if (fileManifest.auxiliary) {
									chunk.auxiliaryFiles.add(file);
								} else {
									chunk.files.add(file);
								}
								// 空调用
								this.hooks.chunkAsset.call(chunk, file);
								alreadyWrittenFiles.set(file, {
									hash: usedHash,
									source,
									chunk
								});
								if (source !== sourceFromCache) {
									assetCacheItem.store(source, err => {
										if (err) return errorAndCallback(err);
										inTry = false;
										return callback();
									});
								} else {
									inTry = false;
									callback();
								}
							} catch (err) {
								if (!inTry) throw err;
								errorAndCallback(err);
							}
						});
					},
					callback
				);
			},
			callback
		);
	}

	// 返回 资源路径信息
	getPath(filename, data = {}) {
		if (!data.hash) {
			data = {
				hash: this.hash,
				...data
			};
		}
		return this.getAssetPath(filename, data);
	}

	/**
	 * @param {string | function(PathData, AssetInfo=): string} filename used to get asset path with hash
	 * @param {PathData} data context data
	 * @returns {{ path: string, info: AssetInfo }} interpolated path and asset info
	 */
	getPathWithInfo(filename, data = {}) {
		if (!data.hash) {
			data = {
				hash: this.hash,
				...data
			};
		}
		return this.getAssetPathWithInfo(filename, data);
	}

	// 
	getAssetPath(filename, data) {
		// TemplatedPathPlugin
		return this.hooks.assetPath.call(
			typeof filename === "function" ? filename(data) : filename,
			data,
			undefined
		);
	}

	// 返回 资源路径和资源信息
	getAssetPathWithInfo(filename, data) {
		const assetInfo = {};
		// TemplatedPathPlugin
		const newPath = this.hooks.assetPath.call(
			typeof filename === "function" ? filename(data, assetInfo) : filename,
			data,
			assetInfo
		);
		return { path: newPath, info: assetInfo };
	}

	// 返回编译过程中出现的警告
	// 通过 Webpack.options.ignoreWarnings 筛选 返回过滤后的 warnings
	getWarnings() {
		return this.hooks.processWarnings.call(this.warnings);
	}

	// 返回编译过程中出现的错误
	getErrors() {
		return this.hooks.processErrors.call(this.errors);
	}

	/**
	 * This function allows you to run another instance of webpack inside of webpack however as
	 * a child with different settings and configurations (if desired) applied. It copies all hooks, plugins
	 * from parent (or top level compiler) and creates a child Compilation
	 *
	 * @param {string} name name of the child compiler
	 * @param {OutputOptions=} outputOptions // Need to convert config schema to types for this
	 * @param {Array<WebpackPluginInstance | WebpackPluginFunction>=} plugins webpack plugins that will be applied
	 * @returns {Compiler} creates a child Compiler instance
	 */
	// 创建 子编译器 的实例
	createChildCompiler(name, outputOptions, plugins) {
		const idx = this.childrenCounters[name] || 0;
		this.childrenCounters[name] = idx + 1;
		return this.compiler.createChildCompiler(
			this,
			name,
			idx,
			outputOptions,
			plugins
		);
	}

	/**
	 * @param {Module} module the module
	 * @param {ExecuteModuleOptions} options options
	 * @param {ExecuteModuleCallback} callback callback
	 */
	executeModule(module, options, callback) {
		// Aggregate all referenced modules and ensure they are ready
		const modules = new Set([module]);
		processAsyncTree(
			modules,
			10,
			/**
			 * @param {Module} module the module
			 * @param {function(Module): void} push push more jobs
			 * @param {Callback} callback callback
			 * @returns {void}
			 */
			(module, push, callback) => {
				this.addModuleQueue.waitFor(module, err => {
					if (err) return callback(err);
					this.buildQueue.waitFor(module, err => {
						if (err) return callback(err);
						this.processDependenciesQueue.waitFor(module, err => {
							if (err) return callback(err);
							for (const {
								module: m
							} of this.moduleGraph.getOutgoingConnections(module)) {
								const size = modules.size;
								modules.add(m);
								if (modules.size !== size) push(m);
							}
							callback();
						});
					});
				});
			},
			err => {
				if (err) return callback(err);

				// Create new chunk graph, chunk and entrypoint for the build time execution
				const chunkGraph = new ChunkGraph(this.moduleGraph);
				const runtime = "build time";
				const { hashFunction, hashDigest, hashDigestLength } =
					this.outputOptions;
				const runtimeTemplate = this.runtimeTemplate;

				const chunk = new Chunk("build time chunk");
				chunk.id = chunk.name;
				chunk.ids = [chunk.id];
				chunk.runtime = runtime;

				const entrypoint = new Entrypoint({
					runtime,
					chunkLoading: false,
					...options.entryOptions
				});
				chunkGraph.connectChunkAndEntryModule(chunk, module, entrypoint);
				connectChunkGroupAndChunk(entrypoint, chunk);
				entrypoint.setRuntimeChunk(chunk);
				entrypoint.setEntrypointChunk(chunk);

				const chunks = new Set([chunk]);

				// Assign ids to modules and modules to the chunk
				for (const module of modules) {
					const id = module.identifier();
					chunkGraph.setModuleId(module, id);
					chunkGraph.connectChunkAndModule(chunk, module);
				}

				// Hash modules
				for (const module of modules) {
					this._createModuleHash(
						module,
						chunkGraph,
						runtime,
						hashFunction,
						runtimeTemplate,
						hashDigest,
						hashDigestLength
					);
				}

				const codeGenerationResults = new CodeGenerationResults();
				/** @type {WebpackError[]} */
				const errors = [];
				/**
				 * @param {Module} module the module
				 * @param {Callback} callback callback
				 * @returns {void}
				 */
				const codeGen = (module, callback) => {
					this._codeGenerationModule(
						module,
						runtime,
						[runtime],
						chunkGraph.getModuleHash(module, runtime),
						this.dependencyTemplates,
						chunkGraph,
						this.moduleGraph,
						runtimeTemplate,
						errors,
						codeGenerationResults,
						(err, codeGenerated) => {
							callback(err);
						}
					);
				};

				const reportErrors = () => {
					if (errors.length > 0) {
						errors.sort(
							compareSelect(err => err.module, compareModulesByIdentifier)
						);
						for (const error of errors) {
							this.errors.push(error);
						}
						errors.length = 0;
					}
				};

				// Generate code for all aggregated modules
				asyncLib.eachLimit(modules, 10, codeGen, err => {
					if (err) return callback(err);
					reportErrors();

					// for backward-compat temporary set the chunk graph
					// TODO webpack 6
					const old = this.chunkGraph;
					this.chunkGraph = chunkGraph;
					this.processRuntimeRequirements({
						chunkGraph,
						modules,
						chunks,
						codeGenerationResults,
						chunkGraphEntries: chunks
					});
					this.chunkGraph = old;

					const runtimeModules =
						chunkGraph.getChunkRuntimeModulesIterable(chunk);

					// Hash runtime modules
					for (const module of runtimeModules) {
						modules.add(module);
						this._createModuleHash(
							module,
							chunkGraph,
							runtime,
							hashFunction,
							runtimeTemplate,
							hashDigest,
							hashDigestLength
						);
					}

					// Generate code for all runtime modules
					asyncLib.eachLimit(runtimeModules, 10, codeGen, err => {
						if (err) return callback(err);
						reportErrors();

						/** @type {Map<Module, ExecuteModuleArgument>} */
						const moduleArgumentsMap = new Map();
						/** @type {Map<string, ExecuteModuleArgument>} */
						const moduleArgumentsById = new Map();

						/** @type {ExecuteModuleResult["fileDependencies"]} */
						const fileDependencies = new LazySet();
						/** @type {ExecuteModuleResult["contextDependencies"]} */
						const contextDependencies = new LazySet();
						/** @type {ExecuteModuleResult["missingDependencies"]} */
						const missingDependencies = new LazySet();
						/** @type {ExecuteModuleResult["buildDependencies"]} */
						const buildDependencies = new LazySet();

						/** @type {ExecuteModuleResult["assets"]} */
						const assets = new Map();

						let cacheable = true;

						/** @type {ExecuteModuleContext} */
						const context = {
							assets,
							__webpack_require__: undefined,
							chunk,
							chunkGraph
						};

						// Prepare execution
						asyncLib.eachLimit(
							modules,
							10,
							(module, callback) => {
								const codeGenerationResult = codeGenerationResults.get(
									module,
									runtime
								);
								/** @type {ExecuteModuleArgument} */
								const moduleArgument = {
									module,
									codeGenerationResult,
									preparedInfo: undefined,
									moduleObject: undefined
								};
								moduleArgumentsMap.set(module, moduleArgument);
								moduleArgumentsById.set(module.identifier(), moduleArgument);
								module.addCacheDependencies(
									fileDependencies,
									contextDependencies,
									missingDependencies,
									buildDependencies
								);
								if (module.buildInfo.cacheable === false) {
									cacheable = false;
								}
								if (module.buildInfo && module.buildInfo.assets) {
									const { assets: moduleAssets, assetsInfo } = module.buildInfo;
									for (const assetName of Object.keys(moduleAssets)) {
										assets.set(assetName, {
											source: moduleAssets[assetName],
											info: assetsInfo ? assetsInfo.get(assetName) : undefined
										});
									}
								}
								this.hooks.prepareModuleExecution.callAsync(
									moduleArgument,
									context,
									callback
								);
							},
							err => {
								if (err) return callback(err);

								let exports;
								try {
									const {
										strictModuleErrorHandling,
										strictModuleExceptionHandling
									} = this.outputOptions;
									const __webpack_require__ = id => {
										const cached = moduleCache[id];
										if (cached !== undefined) {
											if (cached.error) throw cached.error;
											return cached.exports;
										}
										const moduleArgument = moduleArgumentsById.get(id);
										return __webpack_require_module__(moduleArgument, id);
									};
									const interceptModuleExecution = (__webpack_require__[
										RuntimeGlobals.interceptModuleExecution.replace(
											"__webpack_require__.",
											""
										)
									] = []);
									const moduleCache = (__webpack_require__[
										RuntimeGlobals.moduleCache.replace(
											"__webpack_require__.",
											""
										)
									] = {});

									context.__webpack_require__ = __webpack_require__;

									/**
									 * @param {ExecuteModuleArgument} moduleArgument the module argument
									 * @param {string=} id id
									 * @returns {any} exports
									 */
									const __webpack_require_module__ = (moduleArgument, id) => {
										var execOptions = {
											id,
											module: {
												id,
												exports: {},
												loaded: false,
												error: undefined
											},
											require: __webpack_require__
										};
										interceptModuleExecution.forEach(handler =>
											handler(execOptions)
										);
										const module = moduleArgument.module;
										this.buildTimeExecutedModules.add(module);
										const moduleObject = execOptions.module;
										moduleArgument.moduleObject = moduleObject;
										try {
											if (id) moduleCache[id] = moduleObject;

											tryRunOrWebpackError(
												() =>
													this.hooks.executeModule.call(
														moduleArgument,
														context
													),
												"Compilation.hooks.executeModule"
											);
											moduleObject.loaded = true;
											return moduleObject.exports;
										} catch (e) {
											if (strictModuleExceptionHandling) {
												if (id) delete moduleCache[id];
											} else if (strictModuleErrorHandling) {
												moduleObject.error = e;
											}
											if (!e.module) e.module = module;
											throw e;
										}
									};

									for (const runtimeModule of chunkGraph.getChunkRuntimeModulesInOrder(
										chunk
									)) {
										__webpack_require_module__(
											moduleArgumentsMap.get(runtimeModule)
										);
									}
									exports = __webpack_require__(module.identifier());
								} catch (e) {
									const err = new WebpackError(
										`Execution of module code from module graph (${module.readableIdentifier(
											this.requestShortener
										)}) failed: ${e.message}`
									);
									err.stack = e.stack;
									err.module = e.module;
									return callback(err);
								}

								callback(null, {
									exports,
									assets,
									cacheable,
									fileDependencies,
									contextDependencies,
									missingDependencies,
									buildDependencies
								});
							}
						);
					});
				});
			}
		);
	}

	// 检查约束
	checkConstraints() {
		const chunkGraph = this.chunkGraph;

		/** @type {Set<number|string>} */
		const usedIds = new Set();

		for (const module of this.modules) {
			if (module.type === "runtime") continue;
			const moduleId = chunkGraph.getModuleId(module);
			if (moduleId === null) continue;
			if (usedIds.has(moduleId)) {
				throw new Error(`checkConstraints: duplicate module id ${moduleId}`);
			}
			usedIds.add(moduleId);
		}

		for (const chunk of this.chunks) {
			for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
				if (!this.modules.has(module)) {
					throw new Error(
						"checkConstraints: module in chunk but not in compilation " +
							` ${chunk.debugId} ${module.debugId}`
					);
				}
			}
			for (const module of chunkGraph.getChunkEntryModulesIterable(chunk)) {
				if (!this.modules.has(module)) {
					throw new Error(
						"checkConstraints: entry module in chunk but not in compilation " +
							` ${chunk.debugId} ${module.debugId}`
					);
				}
			}
		}

		for (const chunkGroup of this.chunkGroups) {
			chunkGroup.checkConstraints();
		}
	}
}

const compilationPrototype = Compilation.prototype;
// Compilation.prototype.modifyHash 已被 Compilation.hooks.fullHash 替代
Object.defineProperty(compilationPrototype, "modifyHash", {
	writable: false,
	enumerable: false,
	configurable: false,
	value: () => {
		throw new Error(
			"Compilation.modifyHash was removed in favor of Compilation.hooks.fullHash"
		);
	}
});
// Compilation.prototype.cache 已被 Compilation.prototype.getCache 替代
Object.defineProperty(compilationPrototype, "cache", {
	enumerable: false,
	configurable: false,
	get: util.deprecate(
		/**
		 * @this {Compilation} the compilation
		 * @returns {Cache} the cache
		 */
		function () {
			return this.compiler.cache;
		},
		"Compilation.cache was removed in favor of Compilation.getCache()",
		"DEP_WEBPACK_COMPILATION_CACHE"
	),
	set: util.deprecate(
		v => {},
		"Compilation.cache was removed in favor of Compilation.getCache()",
		"DEP_WEBPACK_COMPILATION_CACHE"
	)
});

// 对 compilation.assets 进行加工处理的注册事件默认阶段
// 在编译中添加额外的 asset
Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL = -2000;
// 对 asset 进行了基础预处理
Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS = -1000;
// 从已有 asset 中获取新的 asset
Compilation.PROCESS_ASSETS_STAGE_DERIVED = -200;
// 为现有的 asset 添加额外的内容，例如 banner 或初始代码
Compilation.PROCESS_ASSETS_STAGE_ADDITIONS = -100;
// 以通用的方式优化已有 asset
Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE = 100;
// 优化现有资产的数量，例如，进行合并操作
Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_COUNT = 200;
// 优化现有 asset 兼容性，例如添加 polyfills 或者 vendor prefixes
Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_COMPATIBILITY = 300;
// 优化现有 asset 大小，例如进行压缩或者删除空格
Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE = 400;
// 为 asset 添加开发者工具，例如，提取 source map
Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING = 500;
// 优化已有 asset 数量，例如，通过将 asset 内联到其他 asset 中
Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE = 700;
// 整理现有 asset 列表
Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE = 1000;
// 优化 asset 的 hash 值，例如，生成 asset 内容的真实 hash 值
Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH = 2500;
// 优化已有 asset 的转换操作，例如对 asset 进行压缩，并作为独立的 asset
Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER = 3000;
// 分析已有 asset
Compilation.PROCESS_ASSETS_STAGE_ANALYSE = 4000;
// 创建用于上报的 asset
Compilation.PROCESS_ASSETS_STAGE_REPORT = 5000;

module.exports = Compilation;
