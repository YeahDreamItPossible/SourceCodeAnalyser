"use strict";

const parseJson = require("json-parse-better-errors");
const { getContext, runLoaders } = require("loader-runner");
const querystring = require("querystring");
const { HookMap, SyncHook, AsyncSeriesBailHook } = require("tapable");
const {
	CachedSource,
	OriginalSource,
	RawSource,
	SourceMapSource
} = require("webpack-sources");
const Compilation = require("./Compilation");
const Module = require("./Module");
const ModuleBuildError = require("./ModuleBuildError");
const ModuleError = require("./ModuleError");
const ModuleGraphConnection = require("./ModuleGraphConnection");
const ModuleParseError = require("./ModuleParseError");
const ModuleWarning = require("./ModuleWarning");
const RuntimeGlobals = require("./RuntimeGlobals");
const UnhandledSchemeError = require("./UnhandledSchemeError");
const WebpackError = require("./WebpackError");
const formatLocation = require("./formatLocation");
const LazySet = require("./util/LazySet");
const { isSubset } = require("./util/SetHelpers");
const { getScheme } = require("./util/URLAbsoluteSpecifier");
const {
	compareLocations,
	concatComparators,
	compareSelect,
	keepOriginalOrder
} = require("./util/comparators");
const createHash = require("./util/createHash");
const { join } = require("./util/fs");
const { contextify, absolutify } = require("./util/identifier");
const makeSerializable = require("./util/makeSerializable");
const memoize = require("./util/memoize");

const getInvalidDependenciesModuleWarning = memoize(() =>
	require("./InvalidDependenciesModuleWarning")
);
const getValidate = memoize(() => require("schema-utils").validate);

const ABSOLUTE_PATH_REGEX = /^([a-zA-Z]:\\|\\\\|\/)/;

/**
 * @param {string} context absolute context path
 * @param {string} source a source path
 * @param {Object=} associatedObjectForCache an object to which the cache will be attached
 * @returns {string} new source path
 */
const contextifySourceUrl = (context, source, associatedObjectForCache) => {
	if (source.startsWith("webpack://")) return source;
	return `webpack://${contextify(context, source, associatedObjectForCache)}`;
};

/**
 * @param {string} context absolute context path
 * @param {SourceMap} sourceMap a source map
 * @param {Object=} associatedObjectForCache an object to which the cache will be attached
 * @returns {SourceMap} new source map
 */
const contextifySourceMap = (context, sourceMap, associatedObjectForCache) => {
	if (!Array.isArray(sourceMap.sources)) return sourceMap;
	const { sourceRoot } = sourceMap;
	/** @type {function(string): string} */
	const mapper = !sourceRoot
		? source => source
		: sourceRoot.endsWith("/")
		? source =>
				source.startsWith("/")
					? `${sourceRoot.slice(0, -1)}${source}`
					: `${sourceRoot}${source}`
		: source =>
				source.startsWith("/")
					? `${sourceRoot}${source}`
					: `${sourceRoot}/${source}`;
	const newSources = sourceMap.sources.map(source =>
		contextifySourceUrl(context, mapper(source), associatedObjectForCache)
	);
	return {
		...sourceMap,
		file: "x",
		sourceRoot: undefined,
		sources: newSources
	};
};

/**
 * @param {string | Buffer} input the input
 * @returns {string} the converted string
 */
// 以 字符串 的形式
const asString = input => {
	if (Buffer.isBuffer(input)) {
		return input.toString("utf-8");
	}
	return input;
};

/**
 * @param {string | Buffer} input the input
 * @returns {Buffer} the converted buffer
 */
const asBuffer = input => {
	if (!Buffer.isBuffer(input)) {
		return Buffer.from(input, "utf-8");
	}
	return input;
};

class NonErrorEmittedError extends WebpackError {
	constructor(error) {
		super();

		this.name = "NonErrorEmittedError";
		this.message = "(Emitted value instead of an instance of Error) " + error;
	}
}

makeSerializable(
	NonErrorEmittedError,
	"webpack/lib/NormalModule",
	"NonErrorEmittedError"
);

// WeakMap<Compilation, Hooks>
const compilationHooksMap = new WeakMap();

/**
 * 资源加载路径:
 * import { add } from '../loaders/first.js?auth=Lee!../loaders/second.js?user=Wang!./math.js?ts=123'
 * 模块规则配置:
 * [
 * 		{ test: /\.js$/, loader: './loaders/first.js', options: { name: 'first' } },
 * 		{ test: /\.js$/, loader: './loaders/second.js', options: { name: 'second'} }
 * ]
 */

/**
 * 1. 通过所有的加载器(Loader)返回处理后的source
 * 2. 通过语法解析器(parser) 对代码语法解析
 * 3. 通过代码生成器(generator) 生成中间代码
 */

// 标准模块
// 作用:
//  1. 通过所有的 加载器 返回处理后的 源代码
//  2. 通过 语法解析器 对代码词法语法解析
//  3. 通过 代码生成器 生成中间代码
class NormalModule extends Module {
	// 返回当前 compilation 对应的 hooks
	static getCompilationHooks(compilation) {
		if (!(compilation instanceof Compilation)) {
			throw new TypeError(
				"The 'compilation' argument must be an instance of Compilation"
			);
		}
		let hooks = compilationHooksMap.get(compilation);
		if (hooks === undefined) {
			hooks = {
				// 当创建完 loaderContext 后立即调用
				loader: new SyncHook(["loaderContext", "module"]),
				// 在运行 loaders 之前
				beforeLoaders: new SyncHook(["loaders", "module", "loaderContext"]),
				// 
				readResourceForScheme: new HookMap(
					() => new AsyncSeriesBailHook(["resource", "module"])
				)
			};
			compilationHooksMap.set(compilation, hooks);
		}
		return hooks;
	}

	constructor({
		layer,
		type,
		request,
		userRequest,
		rawRequest,
		loaders,
		resource,
		resourceResolveData,
		matchResource,
		parser,
		parserOptions,
		generator,
		generatorOptions,
		resolveOptions
	}) {
		super(type, getContext(resource), layer);

		// 请求路径
		// 请求(Webpack 内部对 原始请求 内部处理后,  将loaders路径和资源路径组合后的绝对路径)
		// 示例: 
		// /path/loaders/first.js?auth=Lee!/path/loaders/second.js?user=Wang! +
		// /path/laoders/first.js???ruleSet[1].rules[0]!/path/loaders/second.js?ruleSet[1].rules[1]! +
		// /path/math.js?ts=123
		this.request = request;
		// 用户请求路径(将 原始请求 分类后全部转换成 绝对路径)
		// 示例: /path/loaders/first.js?auth=Lee!/path/loaders/second.js?user=Wang!/path/math.js?ts=123
		this.userRequest = userRequest;
		// 原始请求(资源加载路径)
		// 示例: ../loaders/first.js?auth=Lee!../loaders/second.js?user=Wang!./math.js?ts=123
		this.rawRequest = rawRequest;

		// 标识: 经过loader处理后的源代码类型是Buffer 还是String
		this.binary = /^(asset|webassembly)\b/.test(type);

		// 语法分析器
		this.parser = parser;
		// 语法分析器选项
		this.parserOptions = parserOptions;

		// 代码生成器
		this.generator = generator;
		// 代码生成器选项
		this.generatorOptions = generatorOptions;

		// 序列化后的资源路径(绝对路径 且包括参数)
		// 示例: /path/math.js?ts=123
		this.resource = resource;
		// 路径解析器 解析 资源(resource) 后返回的数据
		this.resourceResolveData = resourceResolveData;
		// 匹配的路径资源
		this.matchResource = matchResource;

		// 加载器(包括 满足匹配条件的配置加载器 和 筛选后的行内加载器)
		this.loaders = loaders;
		if (resolveOptions !== undefined) {
			// already declared in super class
			this.resolveOptions = resolveOptions;
		}

		// 当前模块的错误
		this.error = null;
		// 经过Loader处理后的源代码(WebpackSource实例)
		this._source = null;
		// 经过Loader处理后的源代码大小
		this._sourceSizes = undefined;
		// 经过Loader处理后的源代码类型
		this._sourceTypes = undefined;

		// 上次成功构建时的 this.buildMeta
		this._lastSuccessfulBuildMeta = {};
		// 标识: 当前模块是否要强制构建
		// 
		this._forceBuild = true;
		//
		this._isEvaluatingSideEffects = false;
		// 
		// WeakSet<ModuleGraph>
		this._addedSideEffectsBailout = undefined;
	}

	// 返回模块标识符
	identifier() {
		if (this.layer === null) {
			return this.request;
		} else {
			return `${this.request}|${this.layer}`;
		}
	}

	/**
	 * @param {RequestShortener} requestShortener the request shortener
	 * @returns {string} a user readable identifier of the module
	 */
	readableIdentifier(requestShortener) {
		return requestShortener.shorten(this.userRequest);
	}

	/**
	 * @param {LibIdentOptions} options options
	 * @returns {string | null} an identifier for library inclusion
	 */
	//
	libIdent(options) {
		return contextify(
			options.context,
			this.userRequest,
			options.associatedObjectForCache
		);
	}

	// 获取模块绝对路径 但不包含路径参数
	nameForCondition() {
		const resource = this.matchResource || this.resource;
		const idx = resource.indexOf("?");
		if (idx >= 0) return resource.substr(0, idx);
		return resource;
	}

	// 将 缓存的模块信息 更新到当前模块中
	updateCacheModule(module) {
		super.updateCacheModule(module);
		const m = /** @type {NormalModule} */ (module);
		this.binary = m.binary;
		this.request = m.request;
		this.userRequest = m.userRequest;
		this.rawRequest = m.rawRequest;
		this.parser = m.parser;
		this.parserOptions = m.parserOptions;
		this.generator = m.generator;
		this.generatorOptions = m.generatorOptions;
		this.resource = m.resource;
		this.matchResource = m.matchResource;
		this.loaders = m.loaders;
		this._sourceTypes = m._sourceTypes;
		this._sourceSizes = m._sourceSizes;
	}

	// 清除缓存
	cleanupForCache() {
		// Make sure to cache types and sizes before cleanup
		if (this._sourceTypes === undefined) this.getSourceTypes();
		for (const type of this._sourceTypes) {
			this.size(type);
		}
		super.cleanupForCache();
		this.parser = undefined;
		this.parserOptions = undefined;
		this.generator = undefined;
		this.generatorOptions = undefined;
	}

	/**
	 * Module should be unsafe cached. Get data that's needed for that.
	 * This data will be passed to restoreFromUnsafeCache later.
	 * @returns {object} cached data
	 */
	getUnsafeCacheData() {
		const data = super.getUnsafeCacheData();
		data.parserOptions = this.parserOptions;
		data.generatorOptions = this.generatorOptions;
		return data;
	}

	restoreFromUnsafeCache(unsafeCacheData, normalModuleFactory) {
		this._restoreFromUnsafeCache(unsafeCacheData, normalModuleFactory);
	}

	/**
	 * restore unsafe cache data
	 * @param {object} unsafeCacheData data from getUnsafeCacheData
	 * @param {NormalModuleFactory} normalModuleFactory the normal module factory handling the unsafe caching
	 */
	_restoreFromUnsafeCache(unsafeCacheData, normalModuleFactory) {
		super._restoreFromUnsafeCache(unsafeCacheData, normalModuleFactory);
		this.parserOptions = unsafeCacheData.parserOptions;
		this.parser = normalModuleFactory.getParser(this.type, this.parserOptions);
		this.generatorOptions = unsafeCacheData.generatorOptions;
		this.generator = normalModuleFactory.getGenerator(
			this.type,
			this.generatorOptions
		);
		// we assume the generator behaves identically and keep cached sourceTypes/Sizes
	}

	/**
	 * @param {string} context the compilation context
	 * @param {string} name the asset name
	 * @param {string} content the content
	 * @param {string | TODO} sourceMap an optional source map
	 * @param {Object=} associatedObjectForCache object for caching
	 * @returns {Source} the created source
	 */
	createSourceForAsset(
		context,
		name,
		content,
		sourceMap,
		associatedObjectForCache
	) {
		if (sourceMap) {
			if (
				typeof sourceMap === "string" &&
				(this.useSourceMap || this.useSimpleSourceMap)
			) {
				return new OriginalSource(
					content,
					contextifySourceUrl(context, sourceMap, associatedObjectForCache)
				);
			}

			if (this.useSourceMap) {
				return new SourceMapSource(
					content,
					name,
					contextifySourceMap(context, sourceMap, associatedObjectForCache)
				);
			}
		}

		return new RawSource(content);
	}

	// 创建 加载器上下文
	createLoaderContext(resolver, options, compilation, fs) {
		const { requestShortener } = compilation.runtimeTemplate;
		const getCurrentLoaderName = () => {
			const currentLoader = this.getCurrentLoader(loaderContext);
			if (!currentLoader) return "(not in loader scope)";
			return requestShortener.shorten(currentLoader.loader);
		};
		const getResolveContext = () => {
			return {
				fileDependencies: {
					add: d => loaderContext.addDependency(d)
				},
				contextDependencies: {
					add: d => loaderContext.addContextDependency(d)
				},
				missingDependencies: {
					add: d => loaderContext.addMissingDependency(d)
				}
			};
		};
		const getAbsolutify = memoize(() =>
			absolutify.bindCache(compilation.compiler.root)
		);
		const getAbsolutifyInContext = memoize(() =>
			absolutify.bindContextCache(this.context, compilation.compiler.root)
		);
		const getContextify = memoize(() =>
			contextify.bindCache(compilation.compiler.root)
		);
		const getContextifyInContext = memoize(() =>
			contextify.bindContextCache(this.context, compilation.compiler.root)
		);
		const utils = {
			absolutify: (context, request) => {
				return context === this.context
					? getAbsolutifyInContext()(request)
					: getAbsolutify()(context, request);
			},
			contextify: (context, request) => {
				return context === this.context
					? getContextifyInContext()(request)
					: getContextify()(context, request);
			}
		};
		const loaderContext = {
			version: 2,
			getOptions: schema => {
				const loader = this.getCurrentLoader(loaderContext);

				let { options } = loader;

				if (typeof options === "string") {
					if (options.substr(0, 1) === "{" && options.substr(-1) === "}") {
						try {
							options = parseJson(options);
						} catch (e) {
							throw new Error(`Cannot parse string options: ${e.message}`);
						}
					} else {
						options = querystring.parse(options, "&", "=", {
							maxKeys: 0
						});
					}
				}

				if (options === null || options === undefined) {
					options = {};
				}

				if (schema) {
					let name = "Loader";
					let baseDataPath = "options";
					let match;
					if (schema.title && (match = /^(.+) (.+)$/.exec(schema.title))) {
						[, name, baseDataPath] = match;
					}
					getValidate()(schema, options, {
						name,
						baseDataPath
					});
				}

				return options;
			},
			emitWarning: warning => {
				if (!(warning instanceof Error)) {
					warning = new NonErrorEmittedError(warning);
				}
				this.addWarning(
					new ModuleWarning(warning, {
						from: getCurrentLoaderName()
					})
				);
			},
			emitError: error => {
				if (!(error instanceof Error)) {
					error = new NonErrorEmittedError(error);
				}
				this.addError(
					new ModuleError(error, {
						from: getCurrentLoaderName()
					})
				);
			},
			getLogger: name => {
				const currentLoader = this.getCurrentLoader(loaderContext);
				return compilation.getLogger(() =>
					[currentLoader && currentLoader.loader, name, this.identifier()]
						.filter(Boolean)
						.join("|")
				);
			},
			resolve(context, request, callback) {
				resolver.resolve({}, context, request, getResolveContext(), callback);
			},
			getResolve(options) {
				const child = options ? resolver.withOptions(options) : resolver;
				return (context, request, callback) => {
					if (callback) {
						child.resolve({}, context, request, getResolveContext(), callback);
					} else {
						return new Promise((resolve, reject) => {
							child.resolve(
								{},
								context,
								request,
								getResolveContext(),
								(err, result) => {
									if (err) reject(err);
									else resolve(result);
								}
							);
						});
					}
				};
			},
			emitFile: (name, content, sourceMap, assetInfo) => {
				if (!this.buildInfo.assets) {
					this.buildInfo.assets = Object.create(null);
					this.buildInfo.assetsInfo = new Map();
				}
				this.buildInfo.assets[name] = this.createSourceForAsset(
					options.context,
					name,
					content,
					sourceMap,
					compilation.compiler.root
				);
				this.buildInfo.assetsInfo.set(name, assetInfo);
			},
			addBuildDependency: dep => {
				if (this.buildInfo.buildDependencies === undefined) {
					this.buildInfo.buildDependencies = new LazySet();
				}
				this.buildInfo.buildDependencies.add(dep);
			},
			utils,
			rootContext: options.context,
			webpack: true,
			sourceMap: !!this.useSourceMap,
			mode: options.mode || "production",
			_module: this,
			_compilation: compilation,
			_compiler: compilation.compiler,
			fs: fs
		};

		Object.assign(loaderContext, options.loader);

		NormalModule.getCompilationHooks(compilation).loader.call(
			loaderContext,
			this
		);

		return loaderContext;
	}

	// 返回当前loader
	getCurrentLoader(loaderContext, index = loaderContext.loaderIndex) {
		if (
			this.loaders &&
			this.loaders.length &&
			index < this.loaders.length &&
			index >= 0 &&
			this.loaders[index]
		) {
			return this.loaders[index];
		}
		return null;
	}
	
	// 将 Loader 加载后的结果source 封装成 WebpackSource 的实例
	// 原因: 为了快速获取该结果的特性
	createSource(context, content, sourceMap, associatedObjectForCache) {
		if (Buffer.isBuffer(content)) {
			return new RawSource(content);
		}

		// if there is no identifier return raw source
		if (!this.identifier) {
			return new RawSource(content);
		}

		// from here on we assume we have an identifier
		const identifier = this.identifier();

		if (this.useSourceMap && sourceMap) {
			return new SourceMapSource(
				content,
				contextifySourceUrl(context, identifier, associatedObjectForCache),
				contextifySourceMap(context, sourceMap, associatedObjectForCache)
			);
		}

		if (this.useSourceMap || this.useSimpleSourceMap) {
			return new OriginalSource(
				content,
				contextifySourceUrl(context, identifier, associatedObjectForCache)
			);
		}

		return new RawSource(content);
	}

	// 创建 加载器上下文 后运行所有的加载器 并返回加载器的执行结果封装成 WebpackSource 的实例
	doBuild(options, compilation, resolver, fs, callback) {
		// 创建 加载器上下文
		const loaderContext = this.createLoaderContext(
			resolver,
			options,
			compilation,
			fs
		);

		// 处理 加载器 的执行结果
		const processResult = (err, result) => {
			if (err) {
				if (!(err instanceof Error)) {
					err = new NonErrorEmittedError(err);
				}
				const currentLoader = this.getCurrentLoader(loaderContext);
				const error = new ModuleBuildError(err, {
					from:
						currentLoader &&
						compilation.runtimeTemplate.requestShortener.shorten(
							currentLoader.loader
						)
				});
				return callback(error);
			}

			const source = result[0];
			const sourceMap = result.length >= 1 ? result[1] : null;
			const extraInfo = result.length >= 2 ? result[2] : null;

			if (!Buffer.isBuffer(source) && typeof source !== "string") {
				const currentLoader = this.getCurrentLoader(loaderContext, 0);
				const err = new Error(
					`Final loader (${
						currentLoader
							? compilation.runtimeTemplate.requestShortener.shorten(
									currentLoader.loader
							  )
							: "unknown"
					}) didn't return a Buffer or String`
				);
				const error = new ModuleBuildError(err);
				return callback(error);
			}

			// 返回 WebpackSource 的实例
			this._source = this.createSource(
				options.context,
				this.binary ? asBuffer(source) : asString(source),
				sourceMap,
				compilation.compiler.root
			);
			if (this._sourceSizes !== undefined) this._sourceSizes.clear();
			this._ast =
				typeof extraInfo === "object" &&
				extraInfo !== null &&
				extraInfo.webpackAST !== undefined
					? extraInfo.webpackAST
					: null;
			return callback();
		};

		const hooks = NormalModule.getCompilationHooks(compilation);

		try {
			// 空调用
			hooks.beforeLoaders.call(this.loaders, this, loaderContext);
		} catch (err) {
			processResult(err);
			return;
		}

		// 运行所有的加载器 返回加载器的执行结果
		runLoaders(
			{
				resource: this.resource,
				loaders: this.loaders,
				context: loaderContext,
				processResource: (loaderContext, resource, callback) => {
					const scheme = getScheme(resource);
					if (scheme) {
						hooks.readResourceForScheme
							.for(scheme)
							.callAsync(resource, this, (err, result) => {
								if (err) return callback(err);
								if (typeof result !== "string" && !result) {
									return callback(new UnhandledSchemeError(scheme, resource));
								}
								return callback(null, result);
							});
					} else {
						loaderContext.addDependency(resource);
						// 通过 文件流 读取文件
						fs.readFile(resource, callback);
					}
				}
			},
			(err, result) => {
				// Cleanup loaderContext to avoid leaking memory in ICs
				loaderContext._compilation =
					loaderContext._compiler =
					loaderContext._module =
					loaderContext.fs =
						undefined;

				if (!result) {
					return processResult(
						err || new Error("No result from loader-runner processing"),
						null
					);
				}
				this.buildInfo.fileDependencies = new LazySet();
				this.buildInfo.fileDependencies.addAll(result.fileDependencies);
				this.buildInfo.contextDependencies = new LazySet();
				this.buildInfo.contextDependencies.addAll(result.contextDependencies);
				this.buildInfo.missingDependencies = new LazySet();
				this.buildInfo.missingDependencies.addAll(result.missingDependencies);
				if (
					this.loaders.length > 0 &&
					this.buildInfo.buildDependencies === undefined
				) {
					this.buildInfo.buildDependencies = new LazySet();
				}
				for (const loader of this.loaders) {
					this.buildInfo.buildDependencies.add(loader.loader);
				}
				this.buildInfo.cacheable = result.cacheable;
				processResult(err, result.result);
			}
		);
	}

	/**
	 * @param {WebpackError} error the error
	 * @returns {void}
	 */
	markModuleAsErrored(error) {
		// Restore build meta from successful build to keep importing state
		this.buildMeta = { ...this._lastSuccessfulBuildMeta };
		this.error = error;
		this.addError(error);
	}

	// 根据 Webpack.options.module.noParse 字段值 判断当前资源路径是否满足匹配
	applyNoParseRule(rule, content) {
		// must start with "rule" if rule is a string
		if (typeof rule === "string") {
			return content.startsWith(rule);
		}

		if (typeof rule === "function") {
			return rule(content);
		}
		// we assume rule is a regexp
		return rule.test(content);
	}

	// 根据 Webpack.options.module.noParse 字段来判断当前资源是否需要经过语法分析
	shouldPreventParsing(noParseRule, request) {
		if (!noParseRule) {
			return false;
		}

		// we only have one rule to check
		if (!Array.isArray(noParseRule)) {
			// returns "true" if the module is !not! to be parsed
			return this.applyNoParseRule(noParseRule, request);
		}

		for (let i = 0; i < noParseRule.length; i++) {
			const rule = noParseRule[i];
			// early exit on first truthy match
			// this module is !not! to be parsed
			if (this.applyNoParseRule(rule, request)) {
				return true;
			}
		}
		// no match found, so this module !should! be parsed
		return false;
	}

	// 根据 源代码 生成哈希值 并绑定到 buildInfo.hash 上
	_initBuildHash(compilation) {
		const hash = createHash(compilation.outputOptions.hashFunction);
		if (this._source) {
			hash.update("source");
			this._source.updateHash(hash);
		}
		hash.update("meta");
		hash.update(JSON.stringify(this.buildMeta));
		// 构建信息哈希值
		this.buildInfo.hash = /** @type {string} */ (hash.digest("hex"));
	}

	// 构建 标准模块
	// 1. 运行所有加载器 返回加载器处理后的源代码 Source
	// 2. 将 加载器处理后的源代码Source 封装成 WebpackSource 的实例
	// 3. 对 源代码 通过 语法分析器 进行词法、语法分析
	// 4. 创建 当前标准模块 的快照
	build(options, compilation, resolver, fs, callback) {
		this._forceBuild = false;
		this._source = null;
		if (this._sourceSizes !== undefined) this._sourceSizes.clear();
		this._sourceTypes = undefined;
		this._ast = null;
		this.error = null;
		this.clearWarningsAndErrors();
		this.clearDependenciesAndBlocks();
		this.buildMeta = {};
		this.buildInfo = {
			cacheable: false, // 表示当前 Module 能否被缓存
			parsed: true, // 表示当前 Module 已经被语法分析过
			fileDependencies: undefined, // 文件依赖
			contextDependencies: undefined, // 上下文依赖
			missingDependencies: undefined, // 缺失的依赖集合
			buildDependencies: undefined, // 构建依赖
			valueDependencies: undefined, // 值依赖(如: 常量)
			hash: undefined, // 对 source 进行hash
			assets: undefined, // 
			assetsInfo: undefined //
		};

		const startTime = compilation.compiler.fsStartTime || Date.now();

		// doBuild 通过fs获取到源代码 并将源代码 创建RawSource 实例
		return this.doBuild(options, compilation, resolver, fs, err => {
			// if we have an error mark module as failed and exit
			if (err) {
				this.markModuleAsErrored(err);
				this._initBuildHash(compilation);
				return callback();
			}

			// 处理 代码分析器 报错
			const handleParseError = e => {
				const source = this._source.source();
				const loaders = this.loaders.map(item =>
					contextify(options.context, item.loader, compilation.compiler.root)
				);
				const error = new ModuleParseError(source, e, loaders, this.type);
				this.markModuleAsErrored(error);
				this._initBuildHash(compilation);
				return callback();
			};

			// 处理 代码分析器 返回的结果
			const handleParseResult = result => {
				this.dependencies.sort(
					concatComparators(
						compareSelect(a => a.loc, compareLocations),
						keepOriginalOrder(this.dependencies)
					)
				);
				// 设置 this.buildInfo.hash
				this._initBuildHash(compilation);
				this._lastSuccessfulBuildMeta = this.buildMeta;
				return handleBuildDone();
			};

			// 当 模块构建 完成后
			const handleBuildDone = () => {
				const snapshotOptions = compilation.options.snapshot.module;
				if (!this.buildInfo.cacheable || !snapshotOptions) {
					return callback();
				}
				// add warning for all non-absolute paths in fileDependencies, etc
				// This makes it easier to find problems with watching and/or caching
				let nonAbsoluteDependencies = undefined;
				const checkDependencies = deps => {
					for (const dep of deps) {
						if (!ABSOLUTE_PATH_REGEX.test(dep)) {
							if (nonAbsoluteDependencies === undefined)
								nonAbsoluteDependencies = new Set();
							nonAbsoluteDependencies.add(dep);
							deps.delete(dep);
							try {
								const depWithoutGlob = dep.replace(/[\\/]?\*.*$/, "");
								const absolute = join(
									compilation.fileSystemInfo.fs,
									this.context,
									depWithoutGlob
								);
								if (absolute !== dep && ABSOLUTE_PATH_REGEX.test(absolute)) {
									(depWithoutGlob !== dep
										? this.buildInfo.contextDependencies
										: deps
									).add(absolute);
								}
							} catch (e) {
								// ignore
							}
						}
					}
				};
				checkDependencies(this.buildInfo.fileDependencies);
				checkDependencies(this.buildInfo.missingDependencies);
				checkDependencies(this.buildInfo.contextDependencies);
				if (nonAbsoluteDependencies !== undefined) {
					const InvalidDependenciesModuleWarning =
						getInvalidDependenciesModuleWarning();
					this.addWarning(
						new InvalidDependenciesModuleWarning(this, nonAbsoluteDependencies)
					);
				}
				// 创建 当前标准模块 的快照
				// convert file/context/missingDependencies into filesystem snapshot
				compilation.fileSystemInfo.createSnapshot(
					startTime,
					this.buildInfo.fileDependencies,
					this.buildInfo.contextDependencies,
					this.buildInfo.missingDependencies,
					snapshotOptions,
					(err, snapshot) => {
						if (err) {
							this.markModuleAsErrored(err);
							return;
						}
						this.buildInfo.fileDependencies = undefined;
						this.buildInfo.contextDependencies = undefined;
						this.buildInfo.missingDependencies = undefined;
						this.buildInfo.snapshot = snapshot;
						return callback();
					}
				);
			};

			// check if this module should !not! be parsed.
			// if so, exit here;
			const noParseRule = options.module && options.module.noParse;
			if (this.shouldPreventParsing(noParseRule, this.request)) {
				// We assume that we need module and exports
				this.buildInfo.parsed = false;
				this._initBuildHash(compilation);
				return handleBuildDone();
			}

			let result;
			try {
				// 运行 代码分析器 对 源代码 进行表达式、语句分析
				result = this.parser.parse(this._ast || this._source.source(), {
					current: this,
					module: this,
					compilation: compilation,
					options: options
				});
			} catch (e) {
				handleParseError(e);
				return;
			}
			handleParseResult(result);
		});
	}

	/**
	 * @param {ConcatenationBailoutReasonContext} context context
	 * @returns {string | undefined} reason why this module can't be concatenated, undefined when it can be concatenated
	 */
	getConcatenationBailoutReason(context) {
		return this.generator.getConcatenationBailoutReason(this, context);
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @returns {ConnectionState} how this module should be connected to referencing modules when consumed for side-effects only
	 */
	// 返回
	getSideEffectsConnectionState(moduleGraph) {
		if (this.factoryMeta !== undefined) {
			if (this.factoryMeta.sideEffectFree) return false;
			if (this.factoryMeta.sideEffectFree === false) return true;
		}
		if (this.buildMeta !== undefined && this.buildMeta.sideEffectFree) {
			if (this._isEvaluatingSideEffects)
				return ModuleGraphConnection.CIRCULAR_CONNECTION;
			this._isEvaluatingSideEffects = true;
			/** @type {ConnectionState} */
			let current = false;
			for (const dep of this.dependencies) {
				const state = dep.getModuleEvaluationSideEffectsState(moduleGraph);
				if (state === true) {
					if (
						this._addedSideEffectsBailout === undefined
							? ((this._addedSideEffectsBailout = new WeakSet()), true)
							: !this._addedSideEffectsBailout.has(moduleGraph)
					) {
						this._addedSideEffectsBailout.add(moduleGraph);
						moduleGraph
							.getOptimizationBailout(this)
							.push(
								() =>
									`Dependency (${
										dep.type
									}) with side effects at ${formatLocation(dep.loc)}`
							);
					}
					this._isEvaluatingSideEffects = false;
					return true;
				} else if (state !== ModuleGraphConnection.CIRCULAR_CONNECTION) {
					current = ModuleGraphConnection.addConnectionStates(current, state);
				}
			}
			this._isEvaluatingSideEffects = false;
			// When caching is implemented here, make sure to not cache when
			// at least one circular connection was in the loop above
			return current;
		} else {
			return true;
		}
	}

	// 返回模块类型
	getSourceTypes() {
		if (this._sourceTypes === undefined) {
			this._sourceTypes = this.generator.getTypes(this);
		}
		return this._sourceTypes;
	}

	// 通过 代码生成器(generator) 生成中间代码
	codeGeneration({
		dependencyTemplates,
		runtimeTemplate,
		moduleGraph,
		chunkGraph,
		runtime,
		concatenationScope
	}) {
		/** @type {Set<string>} */
		const runtimeRequirements = new Set();

		if (!this.buildInfo.parsed) {
			runtimeRequirements.add(RuntimeGlobals.module);
			runtimeRequirements.add(RuntimeGlobals.exports);
			runtimeRequirements.add(RuntimeGlobals.thisAsExports);
		}

		/** @type {Map<string, any>} */
		let data;
		const getData = () => {
			if (data === undefined) data = new Map();
			return data;
		};

		const sources = new Map();
		for (const type of this.generator.getTypes(this)) {
			// 返回 WebpackSource 的实例
			const source = this.error
				? new RawSource(
						"throw new Error(" + JSON.stringify(this.error.message) + ");"
				  )
				: this.generator.generate(this, {
						dependencyTemplates,
						runtimeTemplate,
						moduleGraph,
						chunkGraph,
						runtimeRequirements,
						runtime,
						concatenationScope,
						getData,
						type
				  });

			if (source) {
				sources.set(type, new CachedSource(source));
			}
		}

		/** @type {CodeGenerationResult} */
		const resultEntry = {
			sources,
			runtimeRequirements,
			data
		};
		return resultEntry;
	}

	// 返回 this._source
	// 返回经过加载器 Loader 处理后的source(WebpackSource实例)
	originalSource() {
		return this._source;
	}

	// 当前模块必须要经过构建
	invalidateBuild() {
		this._forceBuild = true;
	}

	// 判断当前 标准模块 是否需要构建(运行时模块不需要经过构建)
	needBuild({ fileSystemInfo, valueCacheVersions }, callback) {
		// build if enforced
		if (this._forceBuild) return callback(null, true);

		// always try to build in case of an error
		if (this.error) return callback(null, true);

		// always build when module is not cacheable
		if (!this.buildInfo.cacheable) return callback(null, true);

		// build when there is no snapshot to check
		if (!this.buildInfo.snapshot) return callback(null, true);

		// build when valueDependencies have changed
		/** @type {Map<string, string | Set<string>>} */
		const valueDependencies = this.buildInfo.valueDependencies;
		if (valueDependencies) {
			if (!valueCacheVersions) return callback(null, true);
			for (const [key, value] of valueDependencies) {
				if (value === undefined) return callback(null, true);
				const current = valueCacheVersions.get(key);
				if (
					value !== current &&
					(typeof value === "string" ||
						typeof current === "string" ||
						current === undefined ||
						!isSubset(value, current))
				) {
					return callback(null, true);
				}
			}
		}

		// check snapshot for validity
		fileSystemInfo.checkSnapshotValid(this.buildInfo.snapshot, (err, valid) => {
			callback(err, !valid);
		});
	}

	/**
	 * @param {string=} type the source type for which the size should be estimated
	 * @returns {number} the estimated size of the module (must be non-zero)
	 */
	// 
	size(type) {
		const cachedSize =
			this._sourceSizes === undefined ? undefined : this._sourceSizes.get(type);
		if (cachedSize !== undefined) {
			return cachedSize;
		}
		const size = Math.max(1, this.generator.getSize(this, type));
		if (this._sourceSizes === undefined) {
			this._sourceSizes = new Map();
		}
		this._sourceSizes.set(type, size);
		return size;
	}

	/**
	 * @param {LazySet<string>} fileDependencies set where file dependencies are added to
	 * @param {LazySet<string>} contextDependencies set where context dependencies are added to
	 * @param {LazySet<string>} missingDependencies set where missing dependencies are added to
	 * @param {LazySet<string>} buildDependencies set where build dependencies are added to
	 */
	// 
	addCacheDependencies(
		fileDependencies,
		contextDependencies,
		missingDependencies,
		buildDependencies
	) {
		const { snapshot, buildDependencies: buildDeps } = this.buildInfo;
		if (snapshot) {
			fileDependencies.addAll(snapshot.getFileIterable());
			contextDependencies.addAll(snapshot.getContextIterable());
			missingDependencies.addAll(snapshot.getMissingIterable());
		} else {
			const {
				fileDependencies: fileDeps,
				contextDependencies: contextDeps,
				missingDependencies: missingDeps
			} = this.buildInfo;
			if (fileDeps !== undefined) fileDependencies.addAll(fileDeps);
			if (contextDeps !== undefined) contextDependencies.addAll(contextDeps);
			if (missingDeps !== undefined) missingDependencies.addAll(missingDeps);
		}
		if (buildDeps !== undefined) {
			buildDependencies.addAll(buildDeps);
		}
	}

	// 更新hash
	updateHash(hash, context) {
		hash.update(this.buildInfo.hash);
		this.generator.updateHash(hash, {
			module: this,
			...context
		});
		super.updateHash(hash, context);
	}

	serialize(context) {
		const { write } = context;
		// deserialize
		write(this._source);
		write(this.error);
		write(this._lastSuccessfulBuildMeta);
		write(this._forceBuild);
		super.serialize(context);
	}

	static deserialize(context) {
		const obj = new NormalModule({
			// will be deserialized by Module
			layer: null,
			type: "",
			// will be filled by updateCacheModule
			resource: "",
			request: null,
			userRequest: null,
			rawRequest: null,
			loaders: null,
			matchResource: null,
			parser: null,
			parserOptions: null,
			generator: null,
			generatorOptions: null,
			resolveOptions: null
		});
		obj.deserialize(context);
		return obj;
	}

	deserialize(context) {
		const { read } = context;
		this._source = read();
		this.error = read();
		this._lastSuccessfulBuildMeta = read();
		this._forceBuild = read();
		super.deserialize(context);
	}
}

makeSerializable(NormalModule, "webpack/lib/NormalModule");

module.exports = NormalModule;
