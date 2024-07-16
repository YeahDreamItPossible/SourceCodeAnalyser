"use strict";

const util = require("util");
const ChunkGraph = require("./ChunkGraph");
const DependenciesBlock = require("./DependenciesBlock");
const ModuleGraph = require("./ModuleGraph");
const RuntimeGlobals = require("./RuntimeGlobals");
const { first } = require("./util/SetHelpers");
const { compareChunksById } = require("./util/comparators");
const makeSerializable = require("./util/makeSerializable");

/**
 * BuildMeta(打包元信息)
 * moduleArgument:
 * exportsArgument:
 * strict: 是否使用严格模式
 * moduleConcatenationBailout:
 * exportsType: 导出类型( default | namespace | flagged | dynamic)
 * defaultObject: 导出对象( false | redirect | redirect-warn )
 * strictHarmonyModule:
 * async: 是否时异步模块
 * sideEffectFree: 是否具有副作用
 */

/**
 * BuildInfo(打包信息)
 * strict: 是否使用严格模式
 * topLevelDeclarations:
 * module: Webpack.options.output.module
 * cacheable: false, // 表示当前 Module 能否被缓存
 * parsed: true, // 表示当前 Module 已经被语法分析过
 * fileDependencies: undefined, // 
 * contextDependencies: undefined, // 
 * missingDependencies: undefined, //
 * buildDependencies: undefined, //
 * valueDependencies: undefined, //
 * hash: undefined, // 对 source 进行hash
 * assets: undefined, // 
 * assetsInfo: undefined //
 * snapshot: 快照
 * active: 
 */

/**
 * FactoryMeta(工厂元信息)
 * sideEffectFree:
 */

const EMPTY_RESOLVE_OPTIONS = {};

let debugId = 1000;

const DEFAULT_TYPES_UNKNOWN = new Set(["unknown"]);
const DEFAULT_TYPES_JS = new Set(["javascript"]);

// Module.prototype.needRebuild 已被 Module.prototype.needBuild 替代
const deprecatedNeedRebuild = util.deprecate(
	(module, context) => {
		return module.needRebuild(
			context.fileSystemInfo.getDeprecatedFileTimestamps(),
			context.fileSystemInfo.getDeprecatedContextTimestamps()
		);
	},
	"Module.needRebuild is deprecated in favor of Module.needBuild",
	"DEP_WEBPACK_MODULE_NEED_REBUILD"
);

// 模块
class Module extends DependenciesBlock {
	constructor(type, context = null, layer = null) {
		super();
		// 模块类型
		this.type = type;
		// 模块上下文路径(绝对路径)
		// 示例: /path/myProject/src
		this.context = context;
		// 图层
		// 必须得 Webpack.options.experiments.layers = true 时
		// Webpack.options.Entry.layer 或者 Webpack.options.module.Rule.layer 配置
		this.layer = layer;
		// 标识: 标识当前module是否需要Id
		this.needId = true;
		// 模块唯一标识符
		this.debugId = debugId++;

		// 由 ModuleFactory 创建 Module 实例时 传递参数
		// ResolveOptions
		this.resolveOptions = EMPTY_RESOLVE_OPTIONS;
		// 工厂元信息
		this.factoryMeta = undefined;
		// 标识: 是否使用SourceMap
		this.useSourceMap = false;
		// 标识: 是否使用SourceMap
		this.useSimpleSourceMap = false;

		// 警告
		// Array<WebpackError>
		this._warnings = undefined;
		// 错误
		// Array<WebpackError>
		this._errors = undefined;
		// 构建元信息
		this.buildMeta = undefined;
		// 构建信息
		this.buildInfo = undefined;
		// 属于当前模块的演示依赖集合
		// 示例: ConstDependency ProvideDependency
		this.presentationalDependencies = undefined;
	}

	// ChunkGraph
	// 返回 chunkGraphModule.id
	get id() {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.id",
			"DEP_WEBPACK_MODULE_ID"
		).getModuleId(this);
	}

	// ChunkGraph
	// 设置 chunkGraphModule.id
	set id(value) {
		if (value === "") {
			this.needId = false;
			return;
		}
		ChunkGraph.getChunkGraphForModule(
			this,
			"Module.id",
			"DEP_WEBPACK_MODULE_ID"
		).setModuleId(this, value);
	}

	// ChunkGraph
	// 返回 chunkGraphModule.hashes.[].hash
	get hash() {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.hash",
			"DEP_WEBPACK_MODULE_HASH"
		).getModuleHash(this, undefined);
	}

	// ChunkGraph
	// 返回 chunkGraphModule.hashes.[].renderedHash
	get renderedHash() {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.renderedHash",
			"DEP_WEBPACK_MODULE_RENDERED_HASH"
		).getRenderedModuleHash(this, undefined);
	}

	// ModuleGraph
	// 返回 moduleGraphModule.profile
	get profile() {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.profile",
			"DEP_WEBPACK_MODULE_PROFILE"
		).getProfile(this);
	}

	// ModuleGraph
	// 设置 moduleGraphModule.profile
	set profile(value) {
		ModuleGraph.getModuleGraphForModule(
			this,
			"Module.profile",
			"DEP_WEBPACK_MODULE_PROFILE"
		).setProfile(this, value);
	}

	// ModuleGraph
	// 返回 moduleGraphModule.preOrderIndex
	get index() {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.index",
			"DEP_WEBPACK_MODULE_INDEX"
		).getPreOrderIndex(this);
	}

	// ModuleGraph
	// 设置 moduleGraphModule.preOrderIndex
	set index(value) {
		ModuleGraph.getModuleGraphForModule(
			this,
			"Module.index",
			"DEP_WEBPACK_MODULE_INDEX"
		).setPreOrderIndex(this, value);
	}

	// ModuleGraph
	// 返回 moduleGraphModule.postOrderIndex
	get index2() {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.index2",
			"DEP_WEBPACK_MODULE_INDEX2"
		).getPostOrderIndex(this);
	}

	// ModuleGraph
	// 设置 moduleGraphModule.postOrderIndex
	set index2(value) {
		ModuleGraph.getModuleGraphForModule(
			this,
			"Module.index2",
			"DEP_WEBPACK_MODULE_INDEX2"
		).setPostOrderIndex(this, value);
	}

	// ModuleGraph
	// 返回 moduleGraphModule.depth
	get depth() {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.depth",
			"DEP_WEBPACK_MODULE_DEPTH"
		).getDepth(this);
	}

	// ModuleGraph
	// 设置 moduleGraphModule.depth
	set depth(value) {
		ModuleGraph.getModuleGraphForModule(
			this,
			"Module.depth",
			"DEP_WEBPACK_MODULE_DEPTH"
		).setDepth(this, value);
	}

	// ModuleGraph
	// 返回 moduleGraphModule.issuer
	get issuer() {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.issuer",
			"DEP_WEBPACK_MODULE_ISSUER"
		).getIssuer(this);
	}

	// ModuleGraph
	// 设置 moduleGraphModule.issuer
	set issuer(value) {
		ModuleGraph.getModuleGraphForModule(
			this,
			"Module.issuer",
			"DEP_WEBPACK_MODULE_ISSUER"
		).setIssuer(this, value);
	}

	// 
	get usedExports() {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.usedExports",
			"DEP_WEBPACK_MODULE_USED_EXPORTS"
		).getUsedExports(this, undefined);
	}

	// ModuleGraph
	// 返回 moduleGraphModule.optimizationBailout
	get optimizationBailout() {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.optimizationBailout",
			"DEP_WEBPACK_MODULE_OPTIMIZATION_BAILOUT"
		).getOptimizationBailout(this);
	}

	// 
	get optional() {
		return this.isOptional(
			ModuleGraph.getModuleGraphForModule(
				this,
				"Module.optional",
				"DEP_WEBPACK_MODULE_OPTIONAL"
			)
		);
	}

	addChunk(chunk) {
		const chunkGraph = ChunkGraph.getChunkGraphForModule(
			this,
			"Module.addChunk",
			"DEP_WEBPACK_MODULE_ADD_CHUNK"
		);
		if (chunkGraph.isModuleInChunk(this, chunk)) return false;
		chunkGraph.connectChunkAndModule(chunk, this);
		return true;
	}

	removeChunk(chunk) {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.removeChunk",
			"DEP_WEBPACK_MODULE_REMOVE_CHUNK"
		).disconnectChunkAndModule(chunk, this);
	}

	isInChunk(chunk) {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.isInChunk",
			"DEP_WEBPACK_MODULE_IS_IN_CHUNK"
		).isModuleInChunk(this, chunk);
	}

	isEntryModule() {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.isEntryModule",
			"DEP_WEBPACK_MODULE_IS_ENTRY_MODULE"
		).isEntryModule(this);
	}

	getChunks() {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.getChunks",
			"DEP_WEBPACK_MODULE_GET_CHUNKS"
		).getModuleChunks(this);
	}

	getNumberOfChunks() {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.getNumberOfChunks",
			"DEP_WEBPACK_MODULE_GET_NUMBER_OF_CHUNKS"
		).getNumberOfModuleChunks(this);
	}

	get chunksIterable() {
		return ChunkGraph.getChunkGraphForModule(
			this,
			"Module.chunksIterable",
			"DEP_WEBPACK_MODULE_CHUNKS_ITERABLE"
		).getOrderedModuleChunksIterable(this, compareChunksById);
	}

	/**
	 * @param {string} exportName a name of an export
	 * @returns {boolean | null} true, if the export is provided why the module.
	 * null, if it's unknown.
	 * false, if it's not provided.
	 */
	isProvided(exportName) {
		return ModuleGraph.getModuleGraphForModule(
			this,
			"Module.usedExports",
			"DEP_WEBPACK_MODULE_USED_EXPORTS"
		).isExportProvided(this, exportName);
	}
	// BACKWARD-COMPAT END

	/**
	 * @deprecated moved to .buildInfo.exportsArgument
	 * @returns {string} name of the exports argument
	 */
	get exportsArgument() {
		return (this.buildInfo && this.buildInfo.exportsArgument) || "exports";
	}

	/**
	 * @deprecated moved to .buildInfo.moduleArgument
	 * @returns {string} name of the module argument
	 */
	get moduleArgument() {
		return (this.buildInfo && this.buildInfo.moduleArgument) || "module";
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @param {boolean} strict the importing module is strict
	 * @returns {"namespace" | "default-only" | "default-with-named" | "dynamic"} export type
	 * "namespace": Exports is already a namespace object. namespace = exports.
	 * "dynamic": Check at runtime if __esModule is set. When set: namespace = { ...exports, default: exports }. When not set: namespace = { default: exports }.
	 * "default-only": Provide a namespace object with only default export. namespace = { default: exports }
	 * "default-with-named": Provide a namespace object with named and default export. namespace = { ...exports, default: exports }
	 */
	getExportsType(moduleGraph, strict) {
		switch (this.buildMeta && this.buildMeta.exportsType) {
			case "flagged":
				return strict ? "default-with-named" : "namespace";
			case "namespace":
				return "namespace";
			case "default":
				switch (this.buildMeta.defaultObject) {
					case "redirect":
						return "default-with-named";
					case "redirect-warn":
						return strict ? "default-only" : "default-with-named";
					default:
						return "default-only";
				}
			case "dynamic": {
				if (strict) return "default-with-named";
				// Try to figure out value of __esModule by following reexports
				const handleDefault = () => {
					switch (this.buildMeta.defaultObject) {
						case "redirect":
						case "redirect-warn":
							return "default-with-named";
						default:
							return "default-only";
					}
				};
				const exportInfo = moduleGraph.getReadOnlyExportInfo(
					this,
					"__esModule"
				);
				if (exportInfo.provided === false) {
					return handleDefault();
				}
				const target = exportInfo.getTarget(moduleGraph);
				if (
					!target ||
					!target.export ||
					target.export.length !== 1 ||
					target.export[0] !== "__esModule"
				) {
					return "dynamic";
				}
				switch (
					target.module.buildMeta &&
					target.module.buildMeta.exportsType
				) {
					case "flagged":
					case "namespace":
						return "namespace";
					case "default":
						return handleDefault();
					default:
						return "dynamic";
				}
			}
			default:
				return strict ? "default-with-named" : "dynamic";
		}
	}

	// 添加演示依赖(该依赖在 ModuleGraph 不存在依赖关系)
	// 示例: ConstDependency(常量依赖) ProvidedDependency(提供依赖)
	addPresentationalDependency(presentationalDependency) {
		if (this.presentationalDependencies === undefined) {
			this.presentationalDependencies = [];
		}
		this.presentationalDependencies.push(presentationalDependency);
	}

	// 清空所有的演示依赖
	clearDependenciesAndBlocks() {
		if (this.presentationalDependencies !== undefined) {
			this.presentationalDependencies.length = 0;
		}
		super.clearDependenciesAndBlocks();
	}

	// 添加警告
	// warning: <WebpackError>
	addWarning(warning) {
		if (this._warnings === undefined) {
			this._warnings = [];
		}
		this._warnings.push(warning);
	}

	// 返回 Module 中的所有警告
	getWarnings() {
		return this._warnings;
	}

	// 返回 Module 中的警告数量
	getNumberOfWarnings() {
		return this._warnings !== undefined ? this._warnings.length : 0;
	}

	// 添加错误
	// error: <WebpackError>
	addError(error) {
		if (this._errors === undefined) {
			this._errors = [];
		}
		this._errors.push(error);
	}

	// 返回 Module 中的所有错误
	getErrors() {
		return this._errors;
	}

	// 返回 Module 中的错误数量
	getNumberOfErrors() {
		return this._errors !== undefined ? this._errors.length : 0;
	}

	// 清空 Module 中的所有警告 和 错误
	clearWarningsAndErrors() {
		if (this._warnings !== undefined) {
			this._warnings.length = 0;
		}
		if (this._errors !== undefined) {
			this._errors.length = 0;
		}
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @returns {boolean} true, if the module is optional
	 */
	isOptional(moduleGraph) {
		let hasConnections = false;
		for (const r of moduleGraph.getIncomingConnections(this)) {
			if (
				!r.dependency ||
				!r.dependency.optional ||
				!r.isTargetActive(undefined)
			) {
				return false;
			}
			hasConnections = true;
		}
		return hasConnections;
	}

	/**
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @param {Chunk} chunk a chunk
	 * @param {Chunk=} ignoreChunk chunk to be ignored
	 * @returns {boolean} true, if the module is accessible from "chunk" when ignoring "ignoreChunk"
	 */
	isAccessibleInChunk(chunkGraph, chunk, ignoreChunk) {
		// Check if module is accessible in ALL chunk groups
		for (const chunkGroup of chunk.groupsIterable) {
			if (!this.isAccessibleInChunkGroup(chunkGraph, chunkGroup)) return false;
		}
		return true;
	}

	/**
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @param {ChunkGroup} chunkGroup a chunk group
	 * @param {Chunk=} ignoreChunk chunk to be ignored
	 * @returns {boolean} true, if the module is accessible from "chunkGroup" when ignoring "ignoreChunk"
	 */
	isAccessibleInChunkGroup(chunkGraph, chunkGroup, ignoreChunk) {
		const queue = new Set([chunkGroup]);

		// Check if module is accessible from all items of the queue
		queueFor: for (const cg of queue) {
			// 1. If module is in one of the chunks of the group we can continue checking the next items
			//    because it's accessible.
			for (const chunk of cg.chunks) {
				if (chunk !== ignoreChunk && chunkGraph.isModuleInChunk(this, chunk))
					continue queueFor;
			}
			// 2. If the chunk group is initial, we can break here because it's not accessible.
			if (chunkGroup.isInitial()) return false;
			// 3. Enqueue all parents because it must be accessible from ALL parents
			for (const parent of chunkGroup.parentsIterable) queue.add(parent);
		}
		// When we processed through the whole list and we didn't bailout, the module is accessible
		return true;
	}

	/**
	 * @param {Chunk} chunk a chunk
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @returns {boolean} true, if the module has any reason why "chunk" should be included
	 */
	hasReasonForChunk(chunk, moduleGraph, chunkGraph) {
		// check for each reason if we need the chunk
		for (const [
			fromModule,
			connections
		] of moduleGraph.getIncomingConnectionsByOriginModule(this)) {
			if (!connections.some(c => c.isTargetActive(chunk.runtime))) continue;
			for (const originChunk of chunkGraph.getModuleChunksIterable(
				fromModule
			)) {
				// return true if module this is not reachable from originChunk when ignoring chunk
				if (!this.isAccessibleInChunk(chunkGraph, originChunk, chunk))
					return true;
			}
		}
		return false;
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {boolean} true if at least one other module depends on this module
	 */
	hasReasons(moduleGraph, runtime) {
		for (const c of moduleGraph.getIncomingConnections(this)) {
			if (c.isTargetActive(runtime)) return true;
		}
		return false;
	}

	// debug
	toString() {
		return `Module[${this.debugId}: ${this.identifier()}]`;
	}

	// 是否需要构建
	needBuild(context, callback) {
		callback(
			null,
			!this.buildMeta ||
				this.needRebuild === Module.prototype.needRebuild ||
				deprecatedNeedRebuild(this, context)
		);
	}

	// 是否需要重新构建
	needRebuild(fileTimestamps, contextTimestamps) {
		return true;
	}

	// 更新hash值
	updateHash(
		hash,
		context = {
			chunkGraph: ChunkGraph.getChunkGraphForModule(
				this,
				"Module.updateHash",
				"DEP_WEBPACK_MODULE_UPDATE_HASH"
			),
			runtime: undefined
		}
	) {
		const { chunkGraph, runtime } = context;
		hash.update(chunkGraph.getModuleGraphHash(this, runtime));
		if (this.presentationalDependencies !== undefined) {
			for (const dep of this.presentationalDependencies) {
				dep.updateHash(hash, context);
			}
		}
		super.updateHash(hash, context);
	}

	/**
	 * @returns {void}
	 */
	invalidateBuild() {
		// should be overridden to support this feature
	}

	// 抽象方法
	// 返回 标识符
	identifier() {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 抽象方法
	readableIdentifier(requestShortener) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 抽象方法
	// 构建
	build(options, compilation, resolver, fs, callback) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	/**
	 * @abstract
	 * @returns {Set<string>} types available (do not mutate)
	 */
	getSourceTypes() {
		// Better override this method to return the correct types
		if (this.source === Module.prototype.source) {
			return DEFAULT_TYPES_UNKNOWN;
		} else {
			return DEFAULT_TYPES_JS;
		}
	}

	/**
	 * @abstract
	 * @deprecated Use codeGeneration() instead
	 * @param {DependencyTemplates} dependencyTemplates the dependency templates
	 * @param {RuntimeTemplate} runtimeTemplate the runtime template
	 * @param {string=} type the type of source that should be generated
	 * @returns {Source} generated source
	 */
	source(dependencyTemplates, runtimeTemplate, type = "javascript") {
		if (this.codeGeneration === Module.prototype.codeGeneration) {
			const AbstractMethodError = require("./AbstractMethodError");
			throw new AbstractMethodError();
		}
		const chunkGraph = ChunkGraph.getChunkGraphForModule(
			this,
			"Module.source() is deprecated. Use Compilation.codeGenerationResults.getSource(module, runtime, type) instead",
			"DEP_WEBPACK_MODULE_SOURCE"
		);
		/** @type {CodeGenerationContext} */
		const codeGenContext = {
			dependencyTemplates,
			runtimeTemplate,
			moduleGraph: chunkGraph.moduleGraph,
			chunkGraph,
			runtime: undefined
		};
		const sources = this.codeGeneration(codeGenContext).sources;
		return type ? sources.get(type) : sources.get(first(this.getSourceTypes()));
	}

	/* istanbul ignore next */
	/**
	 * @abstract
	 * @param {string=} type the source type for which the size should be estimated
	 * @returns {number} the estimated size of the module (must be non-zero)
	 */
	size(type) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	/**
	 * @param {LibIdentOptions} options options
	 * @returns {string | null} an identifier for library inclusion
	 */
	libIdent(options) {
		return null;
	}

	/**
	 * @returns {string | null} absolute path which should be used for condition matching (usually the resource path)
	 */
	nameForCondition() {
		return null;
	}

	/**
	 * @param {ConcatenationBailoutReasonContext} context context
	 * @returns {string | undefined} reason why this module can't be concatenated, undefined when it can be concatenated
	 */
	getConcatenationBailoutReason(context) {
		return `Module Concatenation is not implemented for ${this.constructor.name}`;
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @returns {ConnectionState} how this module should be connected to referencing modules when consumed for side-effects only
	 */
	getSideEffectsConnectionState(moduleGraph) {
		return true;
	}

	/**
	 * @param {CodeGenerationContext} context context for code generation
	 * @returns {CodeGenerationResult} result
	 */
	codeGeneration(context) {
		// Best override this method
		const sources = new Map();
		for (const type of this.getSourceTypes()) {
			if (type !== "unknown") {
				sources.set(
					type,
					this.source(
						context.dependencyTemplates,
						context.runtimeTemplate,
						type
					)
				);
			}
		}
		return {
			sources,
			runtimeRequirements: new Set([
				RuntimeGlobals.module,
				RuntimeGlobals.exports,
				RuntimeGlobals.require
			])
		};
	}

	/**
	 * @param {Chunk} chunk the chunk which condition should be checked
	 * @param {Compilation} compilation the compilation
	 * @returns {boolean} true, if the chunk is ok for the module
	 */
	chunkCondition(chunk, compilation) {
		return true;
	}

	/**
	 * Assuming this module is in the cache. Update the (cached) module with
	 * the fresh module from the factory. Usually updates internal references
	 * and properties.
	 * @param {Module} module fresh module
	 * @returns {void}
	 */
	updateCacheModule(module) {
		this.type = module.type;
		this.layer = module.layer;
		this.context = module.context;
		this.factoryMeta = module.factoryMeta;
		this.resolveOptions = module.resolveOptions;
	}

	/**
	 * Module should be unsafe cached. Get data that's needed for that.
	 * This data will be passed to restoreFromUnsafeCache later.
	 * @returns {object} cached data
	 */
	getUnsafeCacheData() {
		return {
			factoryMeta: this.factoryMeta,
			resolveOptions: this.resolveOptions
		};
	}

	/**
	 * restore unsafe cache data
	 * @param {object} unsafeCacheData data from getUnsafeCacheData
	 * @param {NormalModuleFactory} normalModuleFactory the normal module factory handling the unsafe caching
	 */
	_restoreFromUnsafeCache(unsafeCacheData, normalModuleFactory) {
		this.factoryMeta = unsafeCacheData.factoryMeta;
		this.resolveOptions = unsafeCacheData.resolveOptions;
	}

	/**
	 * Assuming this module is in the cache. Remove internal references to allow freeing some memory.
	 */
	cleanupForCache() {
		this.factoryMeta = undefined;
		this.resolveOptions = undefined;
	}

	/**
	 * @returns {Source | null} the original source for the module before webpack transformation
	 */
	originalSource() {
		return null;
	}

	/**
	 * @param {LazySet<string>} fileDependencies set where file dependencies are added to
	 * @param {LazySet<string>} contextDependencies set where context dependencies are added to
	 * @param {LazySet<string>} missingDependencies set where missing dependencies are added to
	 * @param {LazySet<string>} buildDependencies set where build dependencies are added to
	 */
	addCacheDependencies(
		fileDependencies,
		contextDependencies,
		missingDependencies,
		buildDependencies
	) {}

	serialize(context) {
		const { write } = context;
		write(this.type);
		write(this.layer);
		write(this.context);
		write(this.resolveOptions);
		write(this.factoryMeta);
		write(this.useSourceMap);
		write(this.useSimpleSourceMap);
		write(
			this._warnings !== undefined && this._warnings.length === 0
				? undefined
				: this._warnings
		);
		write(
			this._errors !== undefined && this._errors.length === 0
				? undefined
				: this._errors
		);
		write(this.buildMeta);
		write(this.buildInfo);
		write(this.presentationalDependencies);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.type = read();
		this.layer = read();
		this.context = read();
		this.resolveOptions = read();
		this.factoryMeta = read();
		this.useSourceMap = read();
		this.useSimpleSourceMap = read();
		this._warnings = read();
		this._errors = read();
		this.buildMeta = read();
		this.buildInfo = read();
		this.presentationalDependencies = read();
		super.deserialize(context);
	}
}

makeSerializable(Module, "webpack/lib/Module");

// 以下属性已被移除
// Module.prototype.hasEqualsChunks 属性被移除
Object.defineProperty(Module.prototype, "hasEqualsChunks", {
	get() {
		throw new Error(
			"Module.hasEqualsChunks was renamed (use hasEqualChunks instead)"
		);
	}
});
// Module.prototype.isUsed 属性被移除
Object.defineProperty(Module.prototype, "isUsed", {
	get() {
		throw new Error(
			"Module.isUsed was renamed (use getUsedName, isExportUsed or isModuleUsed instead)"
		);
	}
});
// Module.prototype.errors 属性被移除
Object.defineProperty(Module.prototype, "errors", {
	get: util.deprecate(
		/**
		 * @this {Module}
		 * @returns {Array<WebpackError>} array
		 */
		function () {
			if (this._errors === undefined) {
				this._errors = [];
			}
			return this._errors;
		},
		"Module.errors was removed (use getErrors instead)",
		"DEP_WEBPACK_MODULE_ERRORS"
	)
});
// Module.prototype.warnings 属性被移除
Object.defineProperty(Module.prototype, "warnings", {
	get: util.deprecate(
		/**
		 * @this {Module}
		 * @returns {Array<WebpackError>} array
		 */
		function () {
			if (this._warnings === undefined) {
				this._warnings = [];
			}
			return this._warnings;
		},
		"Module.warnings was removed (use getWarnings instead)",
		"DEP_WEBPACK_MODULE_WARNINGS"
	)
});
// Module.prototype.used 属性被移除
// ModuleGraph.getUsedExports 替代
Object.defineProperty(Module.prototype, "used", {
	get() {
		throw new Error(
			"Module.used was refactored (use ModuleGraph.getUsedExports instead)"
		);
	},
	set(value) {
		throw new Error(
			"Module.used was refactored (use ModuleGraph.setUsedExports instead)"
		);
	}
});

module.exports = Module;
