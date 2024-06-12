"use strict";

const asyncLib = require("neo-async");
const {
	AsyncSeriesBailHook,
	SyncWaterfallHook,
	SyncBailHook,
	SyncHook,
	HookMap
} = require("tapable");
const ChunkGraph = require("./ChunkGraph");
const Module = require("./Module");
const ModuleFactory = require("./ModuleFactory");
const ModuleGraph = require("./ModuleGraph");
const NormalModule = require("./NormalModule");
const BasicEffectRulePlugin = require("./rules/BasicEffectRulePlugin");
const BasicMatcherRulePlugin = require("./rules/BasicMatcherRulePlugin");
const DescriptionDataMatcherRulePlugin = require("./rules/DescriptionDataMatcherRulePlugin");
const RuleSetCompiler = require("./rules/RuleSetCompiler");
const UseEffectRulePlugin = require("./rules/UseEffectRulePlugin");
const LazySet = require("./util/LazySet");
const { getScheme } = require("./util/URLAbsoluteSpecifier");
const { cachedCleverMerge, cachedSetProperty } = require("./util/cleverMerge");
const { join } = require("./util/fs");
const { parseResource } = require("./util/identifier");

const EMPTY_RESOLVE_OPTIONS = {};
const EMPTY_PARSER_OPTIONS = {};
const EMPTY_GENERATOR_OPTIONS = {};

const MATCH_RESOURCE_REGEX = /^([^!]+)!=!/;

// 根据 Loader 对象 返回序列化后的加载器(Loader)路径(绝对路径 + 参数 + 标识符)
const loaderToIdent = data => {
	if (!data.options) {
		return data.loader;
	}
	if (typeof data.options === "string") {
		return data.loader + "?" + data.options;
	}
	if (typeof data.options !== "object") {
		throw new Error("loader options must be string or object");
	}
	if (data.ident) {
		return data.loader + "??" + data.ident;
	}
	return data.loader + "?" + JSON.stringify(data.options);
};

/**
 * 根据所有的 Loader 对象 和 模块路径 来返回 完整的模块路径
 * 该路径包括 序列化后的加载器(Loader)路径 和 序列化后的模块路径
 */
const stringifyLoadersAndResource = (loaders, resource) => {
	let str = "";
	for (const loader of loaders) {
		str += loaderToIdent(loader) + "!";
	}
	return str + resource;
};

// 根据 Loader.loader 路径 返回标准化后的 Loader 对象
// Loader<{ loader: String, options: String }>
const identToLoaderRequest = resultString => {
	const idx = resultString.indexOf("?");
	if (idx >= 0) {
		const loader = resultString.substr(0, idx);
		const options = resultString.substr(idx + 1);
		return {
			loader,
			options
		};
	} else {
		return {
			loader: resultString,
			options: undefined
		};
	}
};

const needCalls = (times, callback) => {
	return err => {
		if (--times === 0) {
			return callback(err);
		}
		if (err && times > 0) {
			times = NaN;
			return callback(err);
		}
	};
};

const mergeGlobalOptions = (globalOptions, type, localOptions) => {
	const parts = type.split("/");
	let result;
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		const options = globalOptions[current];
		if (typeof options === "object") {
			if (result === undefined) {
				result = options;
			} else {
				result = cachedCleverMerge(result, options);
			}
		}
	}
	if (result === undefined) {
		return localOptions;
	} else {
		return cachedCleverMerge(result, localOptions);
	}
};

// TODO webpack 6 remove
const deprecationChangedHookMessage = (name, hook) => {
	const names = hook.taps
		.map(tapped => {
			return tapped.name;
		})
		.join(", ");

	return (
		`NormalModuleFactory.${name} (${names}) is no longer a waterfall hook, but a bailing hook instead. ` +
		"Do not return the passed object, but modify it instead. " +
		"Returning false will ignore the request and results in no module created."
	);
};

/** @type {WeakMap<ModuleDependency, ModuleFactoryResult & { module: { restoreFromUnsafeCache: Function }}>} */
const unsafeCacheDependencies = new WeakMap();

/** @type {WeakMap<Module, object>} */
const unsafeCacheData = new WeakMap();

// 返回 RuleSetCompiler 的实例
const ruleSetCompiler = new RuleSetCompiler([
	new BasicMatcherRulePlugin("test", "resource"),
	new BasicMatcherRulePlugin("scheme"),
	new BasicMatcherRulePlugin("mimetype"),
	new BasicMatcherRulePlugin("dependency"),
	new BasicMatcherRulePlugin("include", "resource"),
	new BasicMatcherRulePlugin("exclude", "resource", true),
	new BasicMatcherRulePlugin("resource"),
	new BasicMatcherRulePlugin("resourceQuery"),
	new BasicMatcherRulePlugin("resourceFragment"),
	new BasicMatcherRulePlugin("realResource"),
	new BasicMatcherRulePlugin("issuer"),
	new BasicMatcherRulePlugin("compiler"),
	new BasicMatcherRulePlugin("issuerLayer"),
	new DescriptionDataMatcherRulePlugin(),
	new BasicEffectRulePlugin("type"),
	new BasicEffectRulePlugin("sideEffects"),
	new BasicEffectRulePlugin("parser"),
	new BasicEffectRulePlugin("resolve"),
	new BasicEffectRulePlugin("generator"),
	new BasicEffectRulePlugin("layer"),
	new UseEffectRulePlugin()
]);

/**
 * loader分类
 * 1. 前置loader(preLoader)
 * 2. 普通loader(loader)
 * 3. 后置loader(postLoaders)
 */
/**
 * Loader<{ loader: String, options: String, ident: String }>
 * Loader.loader  资源加载器路径(绝对路径)
 * Loader.options 资源加载器选项
 * Loader.ident   资源加载器标识符(id)
 */

/**
 * 正常模块工厂
 * 获取创建 NormalModule 所需要的所有参数,并创建 NormalModule 的实例 
 * 主要参数如下:
 * 1. 所有的资源加载器(Loader)
 * 2. 特定类型的路径解析器(resolver)
 * 3. 特定类型的语法分析器(parser)
 * 4. 特定类型的代码生成器(generator)
 * 5. 解析后的模块路径
 * 6. ...
 * 在获取所有Loader的过程中
 * 1. 根据模块加载路径来获取所有的loaders 并根据模块路径中的前缀(! !! -!)进行筛选
 * 2. 根据匹配规则来筛选匹配后的loaders
 */
class NormalModuleFactory extends ModuleFactory {
	constructor({
		context,
		fs,
		resolverFactory,
		options,
		associatedObjectForCache,
		layers = false
	}) {
		super();
		this.hooks = Object.freeze({
			// 在解析之前
			// 可以通过返回 false 来忽略依赖项
			// 否则 返回 undefined 以继续
			// 作用: 获取创建 NormalModule 所需要的参数
			resolve: new AsyncSeriesBailHook(["resolveData"]),
			// 在解析符合统一资源标志符方案(URI)的请求之前调用
			resolveForScheme: new HookMap(
				() => new AsyncSeriesBailHook(["resourceData", "resolveData"])
			),
			// 当初始化解析之前
			// 应该返回 undefined 以继续
			factorize: new AsyncSeriesBailHook(["resolveData"]),
			// 直接执行回调
			// 当遇到新的依赖项请求时调用 可以通过返回 false 来忽略依赖项
			// 否则 返回 undefined 以继续
			beforeResolve: new AsyncSeriesBailHook(["resolveData"]),
			// 当请求解析后
			afterResolve: new AsyncSeriesBailHook(["resolveData"]),
			// 在创建 NormalModule 的实例前
			createModule: new AsyncSeriesBailHook(["createData", "resolveData"]),
			// 在创建 NormalModule 的实例后
			module: new SyncWaterfallHook(["module", "createData", "resolveData"]),
			// 在创建 Parser 的实例前
			createParser: new HookMap(() => new SyncBailHook(["parserOptions"])),
			// 在创建 Parser 的实例后
			parser: new HookMap(() => new SyncHook(["parser", "parserOptions"])),
			// 在创建 Generator 的实例前
			createGenerator: new HookMap(
				() => new SyncBailHook(["generatorOptions"])
			),
			// 在创建 Generator 的实例后
			generator: new HookMap(
				() => new SyncHook(["generator", "generatorOptions"])
			)
		});
		// 路径解析器
		this.resolverFactory = resolverFactory;

		// 模块匹配规则
		this.ruleSet = ruleSetCompiler.compile([
			{
				rules: options.defaultRules
			},
			{
				rules: options.rules
			}
		]);

		this.unsafeCache = !!options.unsafeCache;
		this.cachePredicate =
			typeof options.unsafeCache === "function"
				? options.unsafeCache
				: () => true;
		this.context = context || "";
		this.fs = fs;

		// 用户自定义语法解析器(Webpack.Config.Module.parser)
		this._globalParserOptions = options.parser;
		// 用户自定义代码生成器(Wepback.Config.Module.generator)
		this._globalGeneratorOptions = options.generator;

		// 缓存
		// Map<Type, WeakMap<ParserOptions, Parser>
		this.parserCache = new Map();
		// Map<Type, WeakMap<GeneratorOptions, Generator>
		this.generatorCache = new Map();
		/** @type {Set<Module>} */
		this._restoredUnsafeCacheEntries = new Set();

		const cacheParseResource = parseResource.bindCache(
			associatedObjectForCache
		);

		// 创建 NormalModule 的实例
		this.hooks.factorize.tapAsync(
			{
				name: "NormalModuleFactory",
				stage: 100
			},
			(resolveData, callback) => {
				this.hooks.resolve.callAsync(resolveData, (err, result) => {
					if (err) return callback(err);

					// Ignored
					if (result === false) return callback();

					// direct module
					if (result instanceof Module) return callback(null, result);

					if (typeof result === "object")
						throw new Error(
							deprecationChangedHookMessage("resolve", this.hooks.resolve) +
								" Returning a Module object will result in this module used as result."
						);

					// 直接执行回调
					this.hooks.afterResolve.callAsync(resolveData, (err, result) => {
						if (err) return callback(err);

						if (typeof result === "object")
							throw new Error(
								deprecationChangedHookMessage(
									"afterResolve",
									this.hooks.afterResolve
								)
							);

						// Ignored
						if (result === false) return callback();

						const createData = resolveData.createData;

						// 直接执行回调
						this.hooks.createModule.callAsync(
							createData,
							resolveData,
							(err, createdModule) => {
								if (!createdModule) {
									if (!resolveData.request) {
										return callback(new Error("Empty dependency (no request)"));
									}

									// 创建NormalModule
									createdModule = new NormalModule(createData);
								}

								// SideEffectsFlagPlugin
								createdModule = this.hooks.module.call(
									createdModule,
									createData,
									resolveData
								);

								return callback(null, createdModule);
							}
						);
					});
				});
			}
		);

		/**
		 * 
		 * 1. 根据 模块引入路径 来获取 所有的行内Loader 和 模块路径
		 * 2. 将行内Loader的loader属性转换成绝对路径
		 * 3. 将模块路径转换成绝对路径
		 * 4. 根据模块路径 和 自定义模块匹配规则 来获取匹配后的 Loader
		 * 5. 将匹配Loader的loader属性转换成绝对路径
		 */
		// 获取创建 NormalModule 所需要的参数
		this.hooks.resolve.tapAsync(
			{
				name: "NormalModuleFactory",
				stage: 100
			},
			(data, callback) => {
				const {
					contextInfo,
					context,
					dependencies,
					request,
					resolveOptions,
					fileDependencies,
					missingDependencies,
					contextDependencies
				} = data;
				const dependencyType =
					(dependencies.length > 0 && dependencies[0].category) || "";
				const loaderResolver = this.getResolver("loader");

				/** @type {ResourceData | undefined} */
				let matchResourceData = undefined;
				// 用户自定义模块加载路径(该路径包括loader路径和模块路径)
				let requestWithoutMatchResource = request;
				// 以 `(任意字符,除了!){1,}!=!` 开头
				// MATCH_RESOURCE_REGEX = /^([^!]+)!=!/
				const matchResourceMatch = MATCH_RESOURCE_REGEX.exec(request);
				if (matchResourceMatch) {
					let matchResource = matchResourceMatch[1];
					// 如果是相对路径 则转化为绝对路径
					if (matchResource.charCodeAt(0) === 46) {
						// 46 === ".", 47 === "/"
						const secondChar = matchResource.charCodeAt(1);
						if (
							secondChar === 47 ||
							(secondChar === 46 && matchResource.charCodeAt(2) === 47)
						) {
							// matchResources以 ./ or ../ 开头
							matchResource = join(this.fs, context, matchResource);
						}
					}
					matchResourceData = {
						resource: matchResource,
						...cacheParseResource(matchResource)
					};
					requestWithoutMatchResource = request.substr(
						matchResourceMatch[0].length
					);
				}
				
				// 模块加载路径是否有禁用loader规则
				const firstChar = requestWithoutMatchResource.charCodeAt(0);
				const secondChar = requestWithoutMatchResource.charCodeAt(1);
				// 使用 -! 前缀，将禁用所有已配置的 preLoader 和 loader，但是不禁用 postLoaders
				const noPreAutoLoaders = firstChar === 45 && secondChar === 33; // startsWith "-!"
				// 使用 ! 前缀，将禁用所有已配置的 normal loader(普通 loader)
				const noAutoLoaders = noPreAutoLoaders || firstChar === 33; // startsWith "!"
				// 使用 !! 前缀，将禁用所有已配置的 loader（preLoader, loader, postLoader）
				const noPrePostAutoLoaders = firstChar === 33 && secondChar === 33;
				// 模块引入路径中解析后的loaders路径
				const rawElements = requestWithoutMatchResource
					.slice(
						noPreAutoLoaders || noPrePostAutoLoaders ? 2 : noAutoLoaders ? 1 : 0
					)
					.split(/!+/);
				// 模块路径(不包括loaders路径)
				const unresolvedResource = rawElements.pop();
				// 正常化所有的loaders<Array<{ loader: String, options: String }>>
				// 此时每个loader的loader是相对路径
				const elements = rawElements.map(identToLoaderRequest);

				const resolveContext = {
					fileDependencies,
					missingDependencies,
					contextDependencies
				};

				/** @type {ResourceDataWithData} */
				let resourceData;
				/** @type {string | undefined} */
				const scheme = getScheme(unresolvedResource);

				let loaders;

				const continueCallback = needCalls(2, err => {
					if (err) return callback(err);

					// 转换行内Loader.options 并设置Loader.ident
					try {
						for (const item of loaders) {
							if (typeof item.options === "string" && item.options[0] === "?") {
								const ident = item.options.substr(1);
								if (ident === "[[missing ident]]") {
									throw new Error(
										"No ident is provided by referenced loader. " +
											"When using a function for Rule.use in config you need to " +
											"provide an 'ident' property for referenced loader options."
									);
								}
								item.options = this.ruleSet.references.get(ident);
								if (item.options === undefined) {
									throw new Error(
										"Invalid ident is provided by referenced loader"
									);
								}
								item.ident = ident;
							}
						}
					} catch (e) {
						return callback(e);
					}

					if (!resourceData) {
						// ignored
						return callback(null, dependencies[0].createIgnoredModule(context));
					}

					// 序列化后的模块路径
					const userRequest =
						(matchResourceData !== undefined
							? `${matchResourceData.resource}!=!`
							: "") +
						stringifyLoadersAndResource(loaders, resourceData.resource);
					// 路径解析器返回的路径信息
					const resourceDataForRules = matchResourceData || resourceData;
					// 通过匹配规则Webpack.Config.Module.Rule来获取匹配的loaders
					const result = this.ruleSet.exec({
						resource: resourceDataForRules.path,
						realResource: resourceData.path,
						resourceQuery: resourceDataForRules.query,
						resourceFragment: resourceDataForRules.fragment,
						scheme,
						mimetype: matchResourceData ? "" : resourceData.data.mimetype || "",
						dependency: dependencyType,
						descriptionData: matchResourceData
							? undefined
							: resourceData.data.descriptionFileData,
						issuer: contextInfo.issuer,
						compiler: contextInfo.compiler,
						issuerLayer: contextInfo.issuerLayer || ""
					});

					// loaders分类
					const settings = {};
					// postLoader
					const useLoadersPost = [];
					// 正常loader
					const useLoaders = [];
					// preLoader
					const useLoadersPre = [];
					// 筛选preLoader loader postLoader
					for (const r of result) {
						if (r.type === "use") {
							if (!noAutoLoaders && !noPrePostAutoLoaders) {
								useLoaders.push(r.value);
							}
						} else if (r.type === "use-post") {
							if (!noPrePostAutoLoaders) {
								useLoadersPost.push(r.value);
							}
						} else if (r.type === "use-pre") {
							if (!noPreAutoLoaders && !noPrePostAutoLoaders) {
								useLoadersPre.push(r.value);
							}
						} else if (
							typeof r.value === "object" &&
							r.value !== null &&
							typeof settings[r.type] === "object" &&
							settings[r.type] !== null
						) {
							settings[r.type] = cachedCleverMerge(settings[r.type], r.value);
						} else {
							settings[r.type] = r.value;
						}
					}

					let postLoaders, normalLoaders, preLoaders;

					const continueCallback = needCalls(3, err => {
						if (err) {
							return callback(err);
						}

						// 合并Loader(筛选后的行内Loader + 匹配规则匹配的Loader)
						const allLoaders = postLoaders;
						if (matchResourceData === undefined) {
							for (const loader of loaders) allLoaders.push(loader);
							for (const loader of normalLoaders) allLoaders.push(loader);
						} else {
							for (const loader of normalLoaders) allLoaders.push(loader);
							for (const loader of loaders) allLoaders.push(loader);
						}
						for (const loader of preLoaders) allLoaders.push(loader);

						let type = settings.type;
						// 设置类型
						if (!type) {
							const resource =
								(matchResourceData && matchResourceData.resource) ||
								resourceData.resource;
							let match;
							if (
								typeof resource === "string" &&
								(match = /\.webpack\[([^\]]+)\]$/.exec(resource))
							) {
								type = match[1];
							} else {
								type = "javascript/auto";
							}
						}
						const resolveOptions = settings.resolve;
						const layer = settings.layer;
						if (layer !== undefined && !layers) {
							return callback(
								new Error(
									"'Rule.layer' is only allowed when 'experiments.layers' is enabled"
								)
							);
						}
						try {
							Object.assign(data.createData, {
								layer:
									layer === undefined ? contextInfo.issuerLayer || null : layer,
								request: stringifyLoadersAndResource(
									allLoaders,
									resourceData.resource
								),
								userRequest,
								rawRequest: request,
								loaders: allLoaders,
								resource: resourceData.resource,
								matchResource: matchResourceData
									? matchResourceData.resource
									: undefined,
								resourceResolveData: resourceData.data,
								settings, // TODO:
								type,
								parser: this.getParser(type, settings.parser),
								parserOptions: settings.parser,
								generator: this.getGenerator(type, settings.generator),
								generatorOptions: settings.generator,
								resolveOptions
							});
						} catch (e) {
							return callback(e);
						}
						callback();
					});

					// 将所有的 后置Loader.loader 属性解析成绝对路径
					this.resolveRequestArray(
						contextInfo,
						this.context,
						useLoadersPost,
						loaderResolver,
						resolveContext,
						(err, result) => {
							postLoaders = result;
							continueCallback(err);
						}
					);
					// 将所有的 正常Loader.loader 属性解析成绝对路径
					this.resolveRequestArray(
						contextInfo,
						this.context,
						useLoaders,
						loaderResolver,
						resolveContext,
						(err, result) => {
							normalLoaders = result;
							continueCallback(err);
						}
					);
					// 将所有的 前置Loader.loader 属性解析成绝对路径
					this.resolveRequestArray(
						contextInfo,
						this.context,
						useLoadersPre,
						loaderResolver,
						resolveContext,
						(err, result) => {
							preLoaders = result;
							continueCallback(err);
						}
					);
				});

				// 将所有的 Loader.loader 属性解析成绝对路径
				this.resolveRequestArray(
					contextInfo,
					context,
					elements,
					loaderResolver,
					resolveContext,
					(err, result) => {
						if (err) return continueCallback(err);
						loaders = result;
						continueCallback();
					}
				);

				// resource with scheme
				if (scheme) {
					resourceData = {
						resource: unresolvedResource,
						data: {},
						path: undefined,
						query: undefined,
						fragment: undefined
					};
					this.hooks.resolveForScheme
						.for(scheme)
						.callAsync(resourceData, data, err => {
							if (err) return continueCallback(err);
							continueCallback();
						});
				}

				// resource without scheme and without path
				else if (/^($|\?)/.test(unresolvedResource)) {
					resourceData = {
						resource: unresolvedResource,
						data: {},
						...cacheParseResource(unresolvedResource)
					};
					continueCallback();
				}

				// resource without scheme and with path
				else {
					// 获取 resolver
					const normalResolver = this.getResolver(
						"normal",
						dependencyType
							? cachedSetProperty(
									resolveOptions || EMPTY_RESOLVE_OPTIONS,
									"dependencyType",
									dependencyType
							  )
							: resolveOptions
					);
					// 获取模块的绝对路径
					this.resolveResource(
						contextInfo,
						context,
						unresolvedResource,
						normalResolver,
						resolveContext,
						(err, resolvedResource, resolvedResourceResolveData) => {
							if (err) return continueCallback(err);
							if (resolvedResource !== false) {
								resourceData = {
									// 模块绝对路径
									resource: resolvedResource,
									// 模块路径信息
									data: resolvedResourceResolveData,
									...cacheParseResource(resolvedResource)
								};
							}
							continueCallback();
						}
					);
				}
			}
		);
	}

	cleanupForCache() {
		for (const module of this._restoredUnsafeCacheEntries) {
			ChunkGraph.clearChunkGraphForModule(module);
			ModuleGraph.clearModuleGraphForModule(module);
			module.cleanupForCache();
		}
	}

	// 创建 NormalModule 的实例
	create(data, callback) {
		const dependencies = /** @type {ModuleDependency[]} */ (data.dependencies);
		if (this.unsafeCache) {
			const cacheEntry = unsafeCacheDependencies.get(dependencies[0]);
			if (cacheEntry) {
				const { module } = cacheEntry;
				if (!this._restoredUnsafeCacheEntries.has(module)) {
					const data = unsafeCacheData.get(module);
					module.restoreFromUnsafeCache(data, this);
					this._restoredUnsafeCacheEntries.add(module);
				}
				return callback(null, cacheEntry);
			}
		}
		const context = data.context || this.context;
		const resolveOptions = data.resolveOptions || EMPTY_RESOLVE_OPTIONS;
		const dependency = dependencies[0];
		const request = dependency.request;
		const contextInfo = data.contextInfo;
		const fileDependencies = new LazySet();
		const missingDependencies = new LazySet();
		const contextDependencies = new LazySet();
		/** @type {ResolveData} */
		const resolveData = {
			contextInfo,
			resolveOptions,
			context,
			request,
			dependencies,
			fileDependencies,
			missingDependencies,
			contextDependencies,
			createData: {},
			cacheable: true
		};

		// 直接执行回调
		this.hooks.beforeResolve.callAsync(resolveData, (err, result) => {
			if (err) {
				return callback(err, {
					fileDependencies,
					missingDependencies,
					contextDependencies
				});
			}

			// Ignored
			if (result === false) {
				return callback(null, {
					fileDependencies,
					missingDependencies,
					contextDependencies
				});
			}

			if (typeof result === "object") {
				throw new Error(
					deprecationChangedHookMessage(
						"beforeResolve",
						this.hooks.beforeResolve
					)
				);
			}

			// 串行执行
			// ExternalModuleFactoryPlugin
			// NormalModuleFactory
			this.hooks.factorize.callAsync(resolveData, (err, module) => {
				// module 为 NormalModule 的实例
				if (err) {
					return callback(err, {
						fileDependencies,
						missingDependencies,
						contextDependencies
					});
				}

				const factoryResult = {
					module,
					fileDependencies,
					missingDependencies,
					contextDependencies
				};

				if (
					this.unsafeCache &&
					resolveData.cacheable &&
					module &&
					module.restoreFromUnsafeCache &&
					this.cachePredicate(module)
				) {
					for (const d of dependencies) {
						unsafeCacheDependencies.set(d, factoryResult);
					}
					if (!unsafeCacheData.has(module)) {
						unsafeCacheData.set(module, module.getUnsafeCacheData());
					}
					this._restoredUnsafeCacheEntries.add(module);
				}

				callback(null, factoryResult);
			});
		});
	}

	/**
	 * 根据模块路径和上下文 返回模块的绝对路径 和绝对路径信息
	 * 底层调用 Resolver.resolve
	 */
	resolveResource(
		contextInfo,
		context,
		unresolvedResource,
		resolver,
		resolveContext,
		callback
	) {
		resolver.resolve(
			contextInfo,
			context,
			unresolvedResource,
			resolveContext,
			(err, resolvedResource, resolvedResourceResolveData) => {
				if (err) {
					return this._resolveResourceErrorHints(
						err,
						contextInfo,
						context,
						unresolvedResource,
						resolver,
						resolveContext,
						(err2, hints) => {
							if (err2) {
								err.message += `
An fatal error happened during resolving additional hints for this error: ${err2.message}`;
								err.stack += `

An fatal error happened during resolving additional hints for this error:
${err2.stack}`;
								return callback(err);
							}
							if (hints && hints.length > 0) {
								err.message += `
${hints.join("\n\n")}`;
							}
							callback(err);
						}
					);
				}
				// resolvedResource 模块绝对路径
				// resolvedResourceResolveData 模块路径信息
				callback(err, resolvedResource, resolvedResourceResolveData);
			}
		);
	}

	_resolveResourceErrorHints(
		error,
		contextInfo,
		context,
		unresolvedResource,
		resolver,
		resolveContext,
		callback
	) {
		asyncLib.parallel(
			[
				callback => {
					if (!resolver.options.fullySpecified) return callback();
					resolver
						.withOptions({
							fullySpecified: false
						})
						.resolve(
							contextInfo,
							context,
							unresolvedResource,
							resolveContext,
							(err, resolvedResource) => {
								if (!err && resolvedResource) {
									const resource = parseResource(resolvedResource).path.replace(
										/^.*[\\/]/,
										""
									);
									return callback(
										null,
										`Did you mean '${resource}'?BREAKING CHANGE: The request '${unresolvedResource}' failed to resolve only because it was resolved as fully specified(probably because the origin is a '*.mjs' file or a '*.js' file where the package.json contains '"type": "module"')The extension in the request is mandatory for it to be fully specified.
Add the extension to the request.`
									);
								}
								callback();
							}
						);
				},
				callback => {
					if (!resolver.options.enforceExtension) return callback();
					resolver
						.withOptions({
							enforceExtension: false,
							extensions: []
						})
						.resolve(
							contextInfo,
							context,
							unresolvedResource,
							resolveContext,
							(err, resolvedResource) => {
								if (!err && resolvedResource) {
									let hint = "";
									const match = /(\.[^.]+)(\?|$)/.exec(unresolvedResource);
									if (match) {
										const fixedRequest = unresolvedResource.replace(
											/(\.[^.]+)(\?|$)/,
											"$2"
										);
										if (resolver.options.extensions.has(match[1])) {
											hint = `Did you mean '${fixedRequest}'?`;
										} else {
											hint = `Did you mean '${fixedRequest}'? Also note that '${match[1]}' is not in 'resolve.extensions' yet and need to be added for this to work?`;
										}
									} else {
										hint = `Did you mean to omit the extension or to remove 'resolve.enforceExtension'?`;
									}
									return callback(
										null,
										`The request '${unresolvedResource}' failed to resolve only because 'resolve.enforceExtension' was specified.
${hint}
Including the extension in the request is no longer possible. Did you mean to enforce including the extension in requests with 'resolve.extensions: []' instead?`
									);
								}
								callback();
							}
						);
				},
				callback => {
					if (
						/^\.\.?\//.test(unresolvedResource) ||
						resolver.options.preferRelative
					) {
						return callback();
					}
					resolver.resolve(
						contextInfo,
						context,
						`./${unresolvedResource}`,
						resolveContext,
						(err, resolvedResource) => {
							if (err || !resolvedResource) return callback();
							const moduleDirectories = resolver.options.modules
								.map(m => (Array.isArray(m) ? m.join(", ") : m))
								.join(", ");
							callback(
								null,
								`Did you mean './${unresolvedResource}'?
Requests that should resolve in the current directory need to start with './'.
Requests that start with a name are treated as module requests and resolve within module directories (${moduleDirectories}).
If changing the source code is not an option there is also a resolve options called 'preferRelative' which tries to resolve these kind of requests in the current directory too.`
							);
						}
					);
				}
			],
			(err, hints) => {
				if (err) return callback(err);
				callback(null, hints.filter(Boolean));
			}
		);
	}

	/**
	 * 将所有的 Loader.loader 属性解析成绝对路径
	 * 底层调用 Resolver.resolve
	 */
	resolveRequestArray(
		contextInfo,
		context,
		array,
		resolver,
		resolveContext,
		callback
	) {
		if (array.length === 0) return callback(null, array);
		asyncLib.map(
			array,
			(item, callback) => {
				resolver.resolve(
					contextInfo,
					context,
					item.loader,
					resolveContext,
					(err, result) => {
						if (
							err &&
							/^[^/]*$/.test(item.loader) &&
							!/-loader$/.test(item.loader)
						) {
							return resolver.resolve(
								contextInfo,
								context,
								item.loader + "-loader",
								resolveContext,
								err2 => {
									if (!err2) {
										err.message =
											err.message +
											"\n" +
											"BREAKING CHANGE: It's no longer allowed to omit the '-loader' suffix when using loaders.\n" +
											`                 You need to specify '${item.loader}-loader' instead of '${item.loader}',\n` +
											"                 see https://webpack.js.org/migrate/3/#automatic-loader-module-name-extension-removed";
									}
									callback(err);
								}
							);
						}
						if (err) return callback(err);

						const parsedResult = identToLoaderRequest(result);
						const resolved = {
							loader: parsedResult.loader,
							options:
								item.options === undefined
									? parsedResult.options
									: item.options,
							ident: item.options === undefined ? undefined : item.ident
						};
						return callback(null, resolved);
					}
				);
			},
			callback
		);
	}

	// 根据 特定类型(type) 返回对应的内置 语法分析器(parser) 并缓存该语法分析器
	getParser(type, parserOptions = EMPTY_PARSER_OPTIONS) {
		let cache = this.parserCache.get(type);

		if (cache === undefined) {
			cache = new WeakMap();
			this.parserCache.set(type, cache);
		}

		let parser = cache.get(parserOptions);

		if (parser === undefined) {
			parser = this.createParser(type, parserOptions);
			cache.set(parserOptions, parser);
		}

		return parser;
	}

	/**
	 * 根据 特定类型(type) 返回对应的内置 语法分析器(parser)
	 * javascript/auto || javascript/dynamic || javascript/esm
	 * asset || asset/inline || asset/resource || asset/source
	 * webassembly/async || webassembly/sync
	 * json
	 */
	createParser(type, parserOptions = {}) {
		parserOptions = mergeGlobalOptions(
			this._globalParserOptions,
			type,
			parserOptions
		);
		const parser = this.hooks.createParser.for(type).call(parserOptions);
		if (!parser) {
			throw new Error(`No parser registered for ${type}`);
		}
		this.hooks.parser.for(type).call(parser, parserOptions);
		return parser;
	}

	/**
	 * 根据 特定类型(type) 返回对应的内置 代码生成器(generator) 并缓存该代码生成器
	 */
	getGenerator(type, generatorOptions = EMPTY_GENERATOR_OPTIONS) {
		let cache = this.generatorCache.get(type);

		if (cache === undefined) {
			cache = new WeakMap();
			this.generatorCache.set(type, cache);
		}

		let generator = cache.get(generatorOptions);

		if (generator === undefined) {
			generator = this.createGenerator(type, generatorOptions);
			cache.set(generatorOptions, generator);
		}

		return generator;
	}

	/**
	 * 根据 特定类型(type) 返回对应的内置 代码生成器(generator)
	 * asset || asset/inline || asset/resource || asset/source
	 * webassembly/async || webassembly/sync
	 * javascript/auto || javascript/dynamic || javascript/esm
	 * json
	 */
	createGenerator(type, generatorOptions = {}) {
		generatorOptions = mergeGlobalOptions(
			this._globalGeneratorOptions,
			type,
			generatorOptions
		);
		const generator = this.hooks.createGenerator
			.for(type)
			.call(generatorOptions);
		if (!generator) {
			throw new Error(`No generator registered for ${type}`);
		}
		this.hooks.generator.for(type).call(generator, generatorOptions);
		return generator;
	}

	/**
	 * 根据 特定类型(type) 返回对应的 路径解析器(resolver)
	 * noamal || loader
	 */
	getResolver(type, resolveOptions) {
		return this.resolverFactory.get(type, resolveOptions);
	}
}

module.exports = NormalModuleFactory;
