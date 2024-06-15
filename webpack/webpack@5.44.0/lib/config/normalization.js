"use strict";

const util = require("util");

const handledDeprecatedNoEmitOnErrors = util.deprecate(
	(noEmitOnErrors, emitOnErrors) => {
		if (emitOnErrors !== undefined && !noEmitOnErrors === !emitOnErrors) {
			throw new Error(
				"Conflicting use of 'optimization.noEmitOnErrors' and 'optimization.emitOnErrors'. Remove deprecated 'optimization.noEmitOnErrors' from config."
			);
		}
		return !noEmitOnErrors;
	},
	"optimization.noEmitOnErrors is deprecated in favor of optimization.emitOnErrors",
	"DEP_WEBPACK_CONFIGURATION_OPTIMIZATION_NO_EMIT_ON_ERRORS"
);

// 对某个对象进行嵌套解析
const nestedConfig = (value, fn) =>
	value === undefined ? fn(/** @type {T} */ ({})) : fn(value);

// 浅复制
const cloneObject = value => {
	return ({ ...value });
};

// 对某个对象进行嵌套解析
const optionalNestedConfig = (value, fn) =>
	value === undefined ? undefined : fn(value);

// 对某个数组尽心嵌套解析
const nestedArray = (value, fn) => (Array.isArray(value) ? fn(value) : fn([]));

// 对某个数组尽心嵌套解析
const optionalNestedArray = (value, fn) =>
	Array.isArray(value) ? fn(value) : undefined;

// 对某个对象进行嵌套解析
const keyedNestedConfig = (value, fn, customKeys) => {
	const result =
		value === undefined
			? {}
			: Object.keys(value).reduce(
					(obj, key) => (
						(obj[key] = (
							customKeys && key in customKeys ? customKeys[key] : fn
						)(value[key])),
						obj
					),
					/** @type {Record<string, R>} */ ({})
			  );
	if (customKeys) {
		for (const key of Object.keys(customKeys)) {
			if (!(key in result)) {
				result[key] = customKeys[key](/** @type {T} */ ({}));
			}
		}
	}
	return result;
};

// 标准化 Webpack.options
const getNormalizedWebpackOptions = config => {
	return {
		// 当设置 amd 为 false 会禁用 webpack 的 AMD 支持
		amd: config.amd,
		// 当设置 bail 为 true 时 表示当出现第一个 WebpackError 时 将停止打包 默认false
		bail: config.bail,
		// 缓存(缓存生成的 webpack 模块和 chunk 来改善构建速度)
		cache: optionalNestedConfig(config.cache, cache => {
			if (cache === false) return false;
			if (cache === true) {
				return {
					type: "memory",
					maxGenerations: undefined
				};
			}
			switch (cache.type) {
				case "filesystem":
					return {
						// 
						type: "filesystem",
						// 
						allowCollectingMemory: cache.allowCollectingMemory,
						// 
						maxMemoryGenerations: cache.maxMemoryGenerations,
						// 缓存文件在文件系统缓存中的事件
						// 默认值: 5184000000ms(一个月)
						maxAge: cache.maxAge,
						// 是否跟踪并记录缓存项的详细时间信息
						// 默认值: false(不记录)
						profile: cache.profile,
						// 
						buildDependencies: cloneObject(cache.buildDependencies),
						// 缓存文件存放的目录 
						// 默认为 node_modules/.cache/webpack
						cacheDirectory: cache.cacheDirectory,
						// 缓存文件存放的路径
						// 默认值: path.resolve(cache.cacheDirectory, cache.name)
						cacheLocation: cache.cacheLocation,
						// 用于哈希生成的算法
						// 默认值: md4
						hashAlgorithm: cache.hashAlgorithm,
						// 缓存文件的压缩类型
						compression: cache.compression,
						// 缓存存储发生的时间间隔
						// 默认值: 60000ms
						idleTimeout: cache.idleTimeout,
						idleTimeoutForInitialStore: cache.idleTimeoutForInitialStore,
						idleTimeoutAfterLargeChanges: cache.idleTimeoutAfterLargeChanges,
						// 缓存名称
						name: cache.name,
						//
						store: cache.store,
						// 
						version: cache.version
					};
				case undefined:
				case "memory":
					return {
						type: "memory",
						maxGenerations: cache.maxGenerations
					};
				default:
					// @ts-expect-error Property 'type' does not exist on type 'never'. ts(2339)
					throw new Error(`Not implemented cache.type ${cache.type}`);
			}
		}),
		// 上下文
		// 基础目录(绝对路径) 用于从配置中解析入口点(entry point)和 加载器(loader)
		// 默认使用 Node.js 进程的当前工作目录 即: process.cwd()
		context: config.context,
		// 所依赖的 Webpack.options.name 列表
		dependencies: config.dependencies,
		// 开发服务器选项
		devServer: optionalNestedConfig(config.devServer, devServer => ({
			...devServer
		})),
		// 源代码映射工具(开发工具)
		devtool: config.devtool,
		// 入口
		// 开始打包构建的入口
		entry:
			config.entry === undefined
				? { main: {} }
				: typeof config.entry === "function"
				? (
						fn => () =>
							Promise.resolve().then(fn).then(getNormalizedEntryStatic)
				  )(config.entry)
				: getNormalizedEntryStatic(config.entry),
		// 实验特性
		experiments: cloneObject(config.experiments),
		// 外部扩展(从输出的 bundle 中排除依赖)
		externals: config.externals,
		// 外部扩展预设
		externalsPresets: cloneObject(config.externalsPresets),
		// 外部扩展类型
		// 指定 externals 的默认类型
		// 默认值: var
		externalsType: config.externalsType,
		// 忽略掉特定的警告
		ignoreWarnings: config.ignoreWarnings
			? config.ignoreWarnings.map(ignore => {
					if (typeof ignore === "function") return ignore;
					const i = ignore instanceof RegExp ? { message: ignore } : ignore;
					return (warning, { requestShortener }) => {
						if (!i.message && !i.module && !i.file) return false;
						if (i.message && !i.message.test(warning.message)) {
							return false;
						}
						if (
							i.module &&
							(!warning.module ||
								!i.module.test(
									warning.module.readableIdentifier(requestShortener)
								))
						) {
							return false;
						}
						if (i.file && (!warning.file || !i.file.test(warning.file))) {
							return false;
						}
						return true;
					};
			  })
			: undefined,
		// 基础设施水平的日志选项
		infrastructureLogging: cloneObject(config.infrastructureLogging),
		// 在 loader 上下文(loaderContext)中暴漏自定义值
		loader: cloneObject(config.loader),
		// 打包模式 development || production || none
		mode: config.mode,
		// 模块配置
		module: nestedConfig(config.module, module => ({
			noParse: module.noParse,
			unsafeCache: module.unsafeCache,
			parser: keyedNestedConfig(module.parser, cloneObject, {
				javascript: parserOptions => ({
					unknownContextRequest: module.unknownContextRequest,
					unknownContextRegExp: module.unknownContextRegExp,
					unknownContextRecursive: module.unknownContextRecursive,
					unknownContextCritical: module.unknownContextCritical,
					exprContextRequest: module.exprContextRequest,
					exprContextRegExp: module.exprContextRegExp,
					exprContextRecursive: module.exprContextRecursive,
					exprContextCritical: module.exprContextCritical,
					wrappedContextRegExp: module.wrappedContextRegExp,
					wrappedContextRecursive: module.wrappedContextRecursive,
					wrappedContextCritical: module.wrappedContextCritical,
					strictExportPresence: module.strictExportPresence,
					strictThisContextOnImports: module.strictThisContextOnImports,
					...parserOptions
				})
			}),
			generator: cloneObject(module.generator),
			defaultRules: optionalNestedArray(module.defaultRules, r => [...r]),
			rules: nestedArray(module.rules, r => [...r])
		})),
		// 配置名称
		name: config.name,
		// 与 NodeJS 相关
		// 是否 polyfill 或 mock 某些 Node.js 全局变量
		node: nestedConfig(
			config.node,
			node =>
				node && {
					...node
				}
		),
		// 优化
		optimization: nestedConfig(config.optimization, optimization => {
			return {
				...optimization,
				runtimeChunk: getNormalizedOptimizationRuntimeChunk(
					optimization.runtimeChunk
				),
				splitChunks: nestedConfig(
					optimization.splitChunks,
					splitChunks =>
						splitChunks && {
							...splitChunks,
							defaultSizeTypes: splitChunks.defaultSizeTypes
								? [...splitChunks.defaultSizeTypes]
								: ["..."],
							cacheGroups: cloneObject(splitChunks.cacheGroups)
						}
				),
				emitOnErrors:
					optimization.noEmitOnErrors !== undefined
						? handledDeprecatedNoEmitOnErrors(
								optimization.noEmitOnErrors,
								optimization.emitOnErrors
						  )
						: optimization.emitOnErrors
			};
		}),
		// 输出
		output: nestedConfig(config.output, output => {
			const { library } = output;
			const libraryAsName = /** @type {LibraryName} */ (library);
			const libraryBase =
				typeof library === "object" &&
				library &&
				!Array.isArray(library) &&
				"type" in library
					? library
					: libraryAsName || output.libraryTarget
					? /** @type {LibraryOptions} */ ({
							name: libraryAsName
					  })
					: undefined;
			/** @type {OutputNormalized} */
			const result = {
				assetModuleFilename: output.assetModuleFilename,
				charset: output.charset,
				chunkFilename: output.chunkFilename,
				chunkFormat: output.chunkFormat,
				chunkLoading: output.chunkLoading,
				chunkLoadingGlobal: output.chunkLoadingGlobal,
				chunkLoadTimeout: output.chunkLoadTimeout,
				clean: output.clean,
				compareBeforeEmit: output.compareBeforeEmit,
				crossOriginLoading: output.crossOriginLoading,
				devtoolFallbackModuleFilenameTemplate:
					output.devtoolFallbackModuleFilenameTemplate,
				devtoolModuleFilenameTemplate: output.devtoolModuleFilenameTemplate,
				devtoolNamespace: output.devtoolNamespace,
				environment: cloneObject(output.environment),
				enabledChunkLoadingTypes: output.enabledChunkLoadingTypes
					? [...output.enabledChunkLoadingTypes]
					: ["..."],
				enabledLibraryTypes: output.enabledLibraryTypes
					? [...output.enabledLibraryTypes]
					: ["..."],
				enabledWasmLoadingTypes: output.enabledWasmLoadingTypes
					? [...output.enabledWasmLoadingTypes]
					: ["..."],
				filename: output.filename,
				globalObject: output.globalObject,
				hashDigest: output.hashDigest,
				hashDigestLength: output.hashDigestLength,
				hashFunction: output.hashFunction,
				hashSalt: output.hashSalt,
				hotUpdateChunkFilename: output.hotUpdateChunkFilename,
				hotUpdateGlobal: output.hotUpdateGlobal,
				hotUpdateMainFilename: output.hotUpdateMainFilename,
				iife: output.iife,
				importFunctionName: output.importFunctionName,
				importMetaName: output.importMetaName,
				scriptType: output.scriptType,
				library: libraryBase && {
					type:
						output.libraryTarget !== undefined
							? output.libraryTarget
							: libraryBase.type,
					auxiliaryComment:
						output.auxiliaryComment !== undefined
							? output.auxiliaryComment
							: libraryBase.auxiliaryComment,
					export:
						output.libraryExport !== undefined
							? output.libraryExport
							: libraryBase.export,
					name: libraryBase.name,
					umdNamedDefine:
						output.umdNamedDefine !== undefined
							? output.umdNamedDefine
							: libraryBase.umdNamedDefine
				},
				module: output.module,
				path: output.path,
				pathinfo: output.pathinfo,
				publicPath: output.publicPath,
				sourceMapFilename: output.sourceMapFilename,
				sourcePrefix: output.sourcePrefix,
				strictModuleExceptionHandling: output.strictModuleExceptionHandling,
				trustedTypes: optionalNestedConfig(
					output.trustedTypes,
					trustedTypes => {
						if (trustedTypes === true) return {};
						if (typeof trustedTypes === "string")
							return { policyName: trustedTypes };
						return { ...trustedTypes };
					}
				),
				uniqueName: output.uniqueName,
				wasmLoading: output.wasmLoading,
				webassemblyModuleFilename: output.webassemblyModuleFilename,
				workerChunkLoading: output.workerChunkLoading,
				workerWasmLoading: output.workerWasmLoading
			};
			return result;
		}),
		// 并行
		// 限制并行处理的模块数量
		// 默认值: 100
		parallelism: config.parallelism,
		// 性能
		performance: optionalNestedConfig(config.performance, performance => {
			if (performance === false) return false;
			return {
				...performance
			};
		}),
		// 插件
		plugins: nestedArray(config.plugins, p => [...p]),
		// 配置文件
		profile: config.profile,
		// 记录文件输入路径
		recordsInputPath:
			config.recordsInputPath !== undefined
				? config.recordsInputPath
				: config.recordsPath,
		// 记录文件输出路径
		recordsOutputPath:
			config.recordsOutputPath !== undefined
				? config.recordsOutputPath
				: config.recordsPath,
		// 路径解析器 选项
		resolve: nestedConfig(config.resolve, resolve => ({
			...resolve,
			byDependency: keyedNestedConfig(resolve.byDependency, cloneObject)
		})),
		// 路径解析器 选项
		// 仅用于解析 webpack 的 loader 包
		resolveLoader: cloneObject(config.resolveLoader),
		// 快照
		snapshot: nestedConfig(config.snapshot, snapshot => ({
			resolveBuildDependencies: optionalNestedConfig(
				snapshot.resolveBuildDependencies,
				resolveBuildDependencies => ({
					timestamp: resolveBuildDependencies.timestamp,
					hash: resolveBuildDependencies.hash
				})
			),
			buildDependencies: optionalNestedConfig(
				snapshot.buildDependencies,
				buildDependencies => ({
					timestamp: buildDependencies.timestamp,
					hash: buildDependencies.hash
				})
			),
			resolve: optionalNestedConfig(snapshot.resolve, resolve => ({
				timestamp: resolve.timestamp,
				hash: resolve.hash
			})),
			module: optionalNestedConfig(snapshot.module, module => ({
				timestamp: module.timestamp,
				hash: module.hash
			})),
			immutablePaths: optionalNestedArray(snapshot.immutablePaths, p => [...p]),
			managedPaths: optionalNestedArray(snapshot.managedPaths, p => [...p])
		})),
		// 统计对象
		stats: nestedConfig(config.stats, stats => {
			if (stats === false) {
				return {
					preset: "none"
				};
			}
			if (stats === true) {
				return {
					preset: "normal"
				};
			}
			if (typeof stats === "string") {
				return {
					preset: stats
				};
			}
			return {
				...stats
			};
		}),
		// 构建目标
		target: config.target,
		// 观察模式
		// 启用 Watch 模式后 意味着在初始构建之后 webpack 将继续监听任何已解析文件的更改
		watch: config.watch,
		// 观察模式选项
		watchOptions: cloneObject(config.watchOptions)
	};
};

// 标准化 Webpack.options.entry
const getNormalizedEntryStatic = entry => {
	if (typeof entry === "string") {
		return {
			main: {
				import: [entry]
			}
		};
	}
	if (Array.isArray(entry)) {
		return {
			main: {
				import: entry
			}
		};
	}
	/** @type {EntryStaticNormalized} */
	const result = {};
	for (const key of Object.keys(entry)) {
		const value = entry[key];
		if (typeof value === "string") {
			result[key] = {
				import: [value]
			};
		} else if (Array.isArray(value)) {
			result[key] = {
				import: value
			};
		} else {
			result[key] = {
				import:
					value.import &&
					(Array.isArray(value.import) ? value.import : [value.import]),
				filename: value.filename,
				layer: value.layer,
				runtime: value.runtime,
				publicPath: value.publicPath,
				chunkLoading: value.chunkLoading,
				wasmLoading: value.wasmLoading,
				dependOn:
					value.dependOn &&
					(Array.isArray(value.dependOn) ? value.dependOn : [value.dependOn]),
				library: value.library
			};
		}
	}
	return result;
};

// 标准化 Webpack.options.optimization.runtimeChunk
const getNormalizedOptimizationRuntimeChunk = runtimeChunk => {
	if (runtimeChunk === undefined) return undefined;
	if (runtimeChunk === false) return false;
	if (runtimeChunk === "single") {
		return {
			name: () => "runtime"
		};
	}
	if (runtimeChunk === true || runtimeChunk === "multiple") {
		return {
			name: entrypoint => `runtime~${entrypoint.name}`
		};
	}
	const { name } = runtimeChunk;
	return {
		name: typeof name === "function" ? name : () => name
	};
};

// 主要对用户 Webpack.options 标准化
exports.getNormalizedWebpackOptions = getNormalizedWebpackOptions;
