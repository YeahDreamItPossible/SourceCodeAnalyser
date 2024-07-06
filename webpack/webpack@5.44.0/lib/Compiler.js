"use strict";

const parseJson = require("json-parse-better-errors");
const asyncLib = require("neo-async");
const {
	SyncHook,
	SyncBailHook,
	AsyncParallelHook,
	AsyncSeriesHook
} = require("tapable");
const { SizeOnlySource } = require("webpack-sources");
const webpack = require("./");
const Cache = require("./Cache");
const CacheFacade = require("./CacheFacade");
const ChunkGraph = require("./ChunkGraph");
const Compilation = require("./Compilation");
const ConcurrentCompilationError = require("./ConcurrentCompilationError");
const ContextModuleFactory = require("./ContextModuleFactory");
const ModuleGraph = require("./ModuleGraph");
const NormalModuleFactory = require("./NormalModuleFactory");
const RequestShortener = require("./RequestShortener");
const ResolverFactory = require("./ResolverFactory");
const Stats = require("./Stats");
const Watching = require("./Watching");
const WebpackError = require("./WebpackError");
const { Logger } = require("./logging/Logger");
const { join, dirname, mkdirp } = require("./util/fs");
const { makePathsRelative } = require("./util/identifier");
const { isSourceEqual } = require("./util/source");

// 断言: 当前数组是否是递减的
const isSorted = array => {
	for (let i = 1; i < array.length; i++) {
		if (array[i - 1] > array[i]) return false;
	}
	return true;
};

// 返回排序后的对象(通过对象键排序)
// 对对象通过键排序
const sortObject = (obj, keys) => {
	const o = {};
	for (const k of keys.sort()) {
		o[k] = obj[k];
	}
	return o;
};

// 判断 当前 filename 是否含有hash数组中某个hash值
const includesHash = (filename, hashes) => {
	if (!hashes) return false;
	if (Array.isArray(hashes)) {
		return hashes.some(hash => filename.includes(hash));
	} else {
		return filename.includes(hashes);
	}
};

// 编译器
class Compiler {
	constructor(context) {
		this.hooks = Object.freeze({
			// 当根据选项 注册完不同的内置插件后
			initialize: new SyncHook([]),
			// 返回 是否应该把 asset 输出到 output 目录前
			// NoEmitOnErrorsPlugin
			shouldEmit: new SyncBailHook(["compilation"]),
			// 当 完成一次完整的编译过程(compilation) 时 主要用于输出stats
			// IdleFileCachePlugin
			// ProfilingPlugin
			done: new AsyncSeriesHook(["stats"]),
			// 当 完成一次完整的编译过程(compilation) 并缓存 编译过程结果后 主要用于输出stats
			// MemoryWithGcCachePlugin
			afterDone: new SyncHook(["stats"]),
			// 此 钩子 允许再进行一个构建
			// 当调用完 compiler.hooks.done 后立即调用
			additionalPass: new AsyncSeriesHook([]),
			// 当开始执行一次构建之前调用
			// NodeEnvironmentPlugin
			beforeRun: new AsyncSeriesHook(["compiler"]),
			// 当开始执行构建时
			// 当调用完 compiler.hooks.beforeRun 后立即调用
			run: new AsyncSeriesHook(["compiler"]),
			// 当要把 asset 输出到 output 目录之前执行
			// CleanPlugin
			// LibManifestPlugin
			emit: new AsyncSeriesHook(["compilation"]),
			// 当把每个 asset 输出到 output 目录后执行
			assetEmitted: new AsyncSeriesHook(["file", "info"]),
			// 当把所有的 asset 输出到 output 目录后执行
			// SizeLimitsPlugin
			afterEmit: new AsyncSeriesHook(["compilation"]),
			// 当创建完 Compilation 的实例后
			// 这个钩子不会被复制到子编译器中
			// 注册只属于当前 compilation 的插件
			// ...(插件太多)
			thisCompilation: new SyncHook(["compilation", "params"]),
			// 当创建完 Compilation 的实例后
			// 注册完 compiler.hooks.thisCompilation 后立即注册
			// 注册所有 compilation 共享的插件
			// ...(插件太多)
			compilation: new SyncHook(["compilation", "params"]),
			// 当创建完 NormalModuleFactory 的实例后
			// NormalModuleReplacementPlugin
			// IgnorePlugin
			normalModuleFactory: new SyncHook(["normalModuleFactory"]),
			// 当创建完 ContextModuleFactory 的实例后
			contextModuleFactory: new SyncHook(["contextModuleFactory"]),
			// 当创建完 compilation params 后
			beforeCompile: new AsyncSeriesHook(["params"]),
			// 当调用 compiler.hooks.beforeCompile 后 
			compile: new SyncHook(["params"]),
			// 当创建 Compilation 的实例后 要添加入口 开始构建模块树
			// EntryPlugin
			// PrefetchPlugin
			// DynamicEntryPlugin
			// DllEntryPlugin
			// AutomaticPrefetchPlugin
			// ContainerPlugin
			make: new AsyncParallelHook(["compilation"]),
			// 当 Compilation 构建模块树后
			// ProvideSharedPlugin
			finishMake: new AsyncSeriesHook(["compilation"]),
			// 当 完成编译 后
			// AutomaticPrefetchPlugin
			// ProgressPlugin
			afterCompile: new AsyncSeriesHook(["compilation"]),

			// 与 监听器 相关
			// Watching
			watchRun: new AsyncSeriesHook(["compiler"]),
			// Watching
			failed: new SyncHook(["error"]),
			// 
			invalid: new SyncHook(["filename", "changeTime"]),
			// 
			watchClose: new SyncHook([]),
			// 当 关闭编译器 时
			// IdleFileCachePlugin
			// MemoryCachePlugin
			// MemoryWithGcCachePlugin
			// LazyCompilationPlugin
			shutdown: new AsyncSeriesHook([]),
			// 在每一次基础日志输出前
			infrastructureLog: new SyncBailHook(["origin", "type", "args"]),
			// 当 标准化 Webpack.optios 并设置完默认值后
			environment: new SyncHook([]),
			// 当 标准化 Webpack.optios 并设置完默认值后
			// 在 compiler.hooks.environment 后立即调用
			// WatchIgnorePlugin
			afterEnvironment: new SyncHook([]),
			// 当根据选项 注册完不同的内置插件后
			afterPlugins: new SyncHook(["compiler"]),
			// 当设置完 resolver options 后
			afterResolvers: new SyncHook(["compiler"]),
			// 当对选项中的 entry 处理完后
			// EntryOptionPlugin
			// DllPlugin
			entryOption: new SyncBailHook(["context", "entry"])
		});
		// 
		this.webpack = webpack;
		// 编译器名称
		// Webpack.options.name
		this.name = undefined;
		// 父编译器名称
		this.parentCompilation = undefined;
		// 当前实例
		this.root = this;
		// 输出路径(绝对路径)
		// 示例: /Users/newstar_lee/Desktop/AllProject/SourceCode/webpack-5.44.0/demo/dist
		this.outputPath = "";
		// 监听器(Watching 的实例)
		this.watching = undefined;
		// 文件系统
		// 输出文件系统
		// OutputFileSystem
		this.outputFileSystem = null;
		// 文件系统
		// IntermediateFileSystem
		this.intermediateFileSystem = null;
		// 输入文件系统
		// InputFileSystem
		this.inputFileSystem = null;
		// 监听文件系统
		// WatchFileSystem
		this.watchFileSystem = null;
		// 记录
		// 指定读取最后一条记录的文件路径
		this.recordsInputPath = null;
		// 指定写入最后一条记录的文件路径
		this.recordsOutputPath = null;
		// 文件记录
		this.records = {};
		// 
		// Webpack.options.snap.managedPaths
		this.managedPaths = new Set();
		// 
		// Webpack.options.snap.immutablePaths
		this.immutablePaths = new Set();
		// Set<string>
		this.modifiedFiles = undefined;
		// Set<string>
		this.removedFiles = undefined;
		// Map<string, FileSystemInfoEntry | "ignore" | null>
		this.fileTimestamps = undefined;
		// Map<string, FileSystemInfoEntry | "ignore" | null>
		this.contextTimestamps = undefined;
		// 编译开始时间
		this.fsStartTime = undefined;

		// 路径解析器工厂
		// 根据 不同的类型 返回对应的 路径解析器
		// 路径解析器: 根据上下文 和 扩展名 将相对路径 通过同步 or 异步的方式解析成 绝对路径
		this.resolverFactory = new ResolverFactory();

		// 日志
		this.infrastructureLogger = undefined;

		// Webpack.options
		this.options = ({});

		// 上下文
		// 默认使用 Node.js 进程的当前工作目录 __dirname
		// 示例: /Users/newstar_lee/Desktop/AllProject/SourceCode/webpack-5.44.0/demo
		this.context = context;
		// 路径缩短器
		// 将 用户资源加载路径 转换成相对于给定上下文的 相对路径
		// Loader Path + Module Path 均为相对路径
		this.requestShortener = new RequestShortener(context, this.root);

		// 缓存
		this.cache = new Cache();

		this.compilerPath = "";

		// 标识: 标识compiler是否正在运行
		// 当前编译器是否正在运行
		this.running = false;
		// 当前编译器是否闲置
		this.idle = false;
		// 当前编译器是否开启watch模式
		this.watchMode = false;

		// 上一个编译过程 Compilation
		this._lastCompilation = undefined;
		// 上一个模块工厂 NormalModuleFactory
		this._lastNormalModuleFactory = undefined;

		// WeakMap<Source, { sizeOnlySource: SizeOnlySource, writtenTo: Map<string, number> }>
		this._assetEmittingSourceCache = new WeakMap();
		// Map<string, number>
		this._assetEmittingWrittenFiles = new Map();
		// Set<string>
		this._assetEmittingPreviousFiles = new Set();
	}

	// 根据 name 返回创建的 CacheFacade 的实例
	getCache(name) {
		return new CacheFacade(this.cache, `${this.compilerPath}${name}`);
	}

	// 创建 给定name的 logger
	getInfrastructureLogger(name) {
		if (!name) {
			throw new TypeError(
				"Compiler.getInfrastructureLogger(name) called without a name"
			);
		}
		return new Logger(
			(type, args) => {
				if (typeof name === "function") {
					name = name();
					if (!name) {
						throw new TypeError(
							"Compiler.getInfrastructureLogger(name) called with a function not returning a name"
						);
					}
				}
				if (this.hooks.infrastructureLog.call(name, type, args) === undefined) {
					if (this.infrastructureLogger !== undefined) {
						this.infrastructureLogger(name, type, args);
					}
				}
			},
			childName => {
				if (typeof name === "function") {
					if (typeof childName === "function") {
						return this.getInfrastructureLogger(() => {
							if (typeof name === "function") {
								name = name();
								if (!name) {
									throw new TypeError(
										"Compiler.getInfrastructureLogger(name) called with a function not returning a name"
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
						return this.getInfrastructureLogger(() => {
							if (typeof name === "function") {
								name = name();
								if (!name) {
									throw new TypeError(
										"Compiler.getInfrastructureLogger(name) called with a function not returning a name"
									);
								}
							}
							return `${name}/${childName}`;
						});
					}
				} else {
					if (typeof childName === "function") {
						return this.getInfrastructureLogger(() => {
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
						return this.getInfrastructureLogger(`${name}/${childName}`);
					}
				}
			}
		);
	}

	// 主要是清除 ModuleGraph存储的module图 和 ChunkGraph存储的chunk图
	_cleanupLastCompilation() {
		// e.g. move compilation specific info from Modules into ModuleGraph
		// 移除 module 和 chunk 的依赖关系
		if (this._lastCompilation !== undefined) {
			for (const module of this._lastCompilation.modules) {
				ChunkGraph.clearChunkGraphForModule(module);
				ModuleGraph.clearModuleGraphForModule(module);
				module.cleanupForCache();
			}
			for (const chunk of this._lastCompilation.chunks) {
				ChunkGraph.clearChunkGraphForChunk(chunk);
			}
			this._lastCompilation = undefined;
		}
	}

	// 主要是清除 NormalModuleFactory实例 内部的缓存
	_cleanupLastNormalModuleFactory() {
		if (this._lastNormalModuleFactory !== undefined) {
			this._lastNormalModuleFactory.cleanupForCache();
			this._lastNormalModuleFactory = undefined;
		}
	}

	// 开启监听模式 如果检测文件发生变化 会再次自动构建
	watch(watchOptions, handler) {
		if (this.running) {
			return handler(new ConcurrentCompilationError());
		}

		this.running = true;
		this.watchMode = true;
		this.watching = new Watching(this, watchOptions, handler);
		return this.watching;
	}

	// 运行编译器
	run(callback) {
		if (this.running) {
			return callback(new ConcurrentCompilationError());
		}

		let logger;

		const finalCallback = (err, stats) => {
			if (logger) logger.time("beginIdle");
			this.idle = true;
			this.cache.beginIdle();
			this.idle = true;
			if (logger) logger.timeEnd("beginIdle");
			this.running = false;
			if (err) {
				this.hooks.failed.call(err);
			}
			if (callback !== undefined) callback(err, stats);
			// 空调用
			this.hooks.afterDone.call(stats);
		};

		const startTime = Date.now();

		this.running = true;

		const onCompiled = (err, compilation) => {
			if (err) return finalCallback(err);

			// 空调用
			if (this.hooks.shouldEmit.call(compilation) === false) {
				compilation.startTime = startTime;
				compilation.endTime = Date.now();
				const stats = new Stats(compilation);
				this.hooks.done.callAsync(stats, err => {
					if (err) return finalCallback(err);
					return finalCallback(null, stats);
				});
				return;
			}

			process.nextTick(() => {
				logger = compilation.getLogger("webpack.Compiler");
				logger.time("emitAssets");

				this.emitAssets(compilation, err => {
					logger.timeEnd("emitAssets");
					if (err) return finalCallback(err);

					if (compilation.hooks.needAdditionalPass.call()) {
						compilation.needAdditionalPass = true;

						compilation.startTime = startTime;
						compilation.endTime = Date.now();
						logger.time("done hook");
						const stats = new Stats(compilation);
						this.hooks.done.callAsync(stats, err => {
							logger.timeEnd("done hook");
							if (err) return finalCallback(err);

							this.hooks.additionalPass.callAsync(err => {
								if (err) return finalCallback(err);
								this.compile(onCompiled);
							});
						});
						return;
					}

					logger.time("emitRecords");
					this.emitRecords(err => {
						logger.timeEnd("emitRecords");
						if (err) return finalCallback(err);

						compilation.startTime = startTime;
						compilation.endTime = Date.now();
						logger.time("done hook");
						const stats = new Stats(compilation);
						// 直接执行回调
						this.hooks.done.callAsync(stats, err => {
							logger.timeEnd("done hook");
							if (err) return finalCallback(err);
							this.cache.storeBuildDependencies(
								compilation.buildDependencies,
								err => {
									if (err) return finalCallback(err);
									return finalCallback(null, stats);
								}
							);
						});
					});
				});
			});
		};

		const run = () => {
			// NodeEnvironmentPlugin 插件(绑定compiler文件系统api)
			// 标识 compiler 开始
			this.hooks.beforeRun.callAsync(this, err => {
				if (err) return finalCallback(err);

				// 直接执行回调
				this.hooks.run.callAsync(this, err => {
					if (err) return finalCallback(err);

					this.readRecords(err => {
						if (err) return finalCallback(err);

						this.compile(onCompiled);
					});
				});
			});
		};

		if (this.idle) {
			this.cache.endIdle(err => {
				if (err) return finalCallback(err);

				this.idle = false;
				run();
			});
		} else {
			run();
		}
	}

	// 作为子编译器运行
	runAsChild(callback) {
		const startTime = Date.now();
		this.compile((err, compilation) => {
			if (err) return callback(err);

			this.parentCompilation.children.push(compilation);
			for (const { name, source, info } of compilation.getAssets()) {
				this.parentCompilation.emitAsset(name, source, info);
			}

			const entries = [];
			for (const ep of compilation.entrypoints.values()) {
				entries.push(...ep.chunks);
			}

			compilation.startTime = startTime;
			compilation.endTime = Date.now();

			return callback(null, entries, compilation);
		});
	}

	purgeInputFileSystem() {
		if (this.inputFileSystem && this.inputFileSystem.purge) {
			this.inputFileSystem.purge();
		}
	}

	// 创建目录 并写入文件
	emitAssets(compilation, callback) {
		let outputPath;

		const emitFiles = err => {
			if (err) return callback(err);

			const assets = compilation.getAssets();
			compilation.assets = { ...compilation.assets };
			// Map<string, { path: string, source: Source, size: number, waiting: { cacheEntry: any, file: string }[] }>
			const caseInsensitiveMap = new Map();
			// Set<string>
			const allTargetPaths = new Set();
			asyncLib.forEachLimit(
				assets,
				15,
				({ name: file, source, info }, callback) => {
					let targetFile = file;
					let immutable = info.immutable;
					// 输出目录上带有参数
					const queryStringIdx = targetFile.indexOf("?");
					if (queryStringIdx >= 0) {
						targetFile = targetFile.substr(0, queryStringIdx);
						// We may remove the hash, which is in the query string
						// So we recheck if the file is immutable
						// This doesn't cover all cases, but immutable is only a performance optimization anyway
						immutable =
							immutable &&
							(includesHash(targetFile, info.contenthash) ||
								includesHash(targetFile, info.chunkhash) ||
								includesHash(targetFile, info.modulehash) ||
								includesHash(targetFile, info.fullhash));
					}

					const writeOut = err => {
						if (err) return callback(err);
						const targetPath = join(
							this.outputFileSystem,
							outputPath,
							targetFile
						);
						allTargetPaths.add(targetPath);

						// check if the target file has already been written by this Compiler
						const targetFileGeneration =
							this._assetEmittingWrittenFiles.get(targetPath);

						// create an cache entry for this Source if not already existing
						let cacheEntry = this._assetEmittingSourceCache.get(source);
						if (cacheEntry === undefined) {
							cacheEntry = {
								sizeOnlySource: undefined,
								writtenTo: new Map()
							};
							this._assetEmittingSourceCache.set(source, cacheEntry);
						}

						let similarEntry;

						const checkSimilarFile = () => {
							const caseInsensitiveTargetPath = targetPath.toLowerCase();
							similarEntry = caseInsensitiveMap.get(caseInsensitiveTargetPath);
							if (similarEntry !== undefined) {
								const { path: other, source: otherSource } = similarEntry;
								if (isSourceEqual(otherSource, source)) {
									// Size may or may not be available at this point.
									// If it's not available add to "waiting" list and it will be updated once available
									if (similarEntry.size !== undefined) {
										updateWithReplacementSource(similarEntry.size);
									} else {
										if (!similarEntry.waiting) similarEntry.waiting = [];
										similarEntry.waiting.push({ file, cacheEntry });
									}
									alreadyWritten();
								} else {
									const err = new WebpackError(`Prevent writing to file that only differs in casing or query string from already written file.This will lead to a race-condition and corrupted files on case-insensitive file systems.${targetPath}${other}`);
									err.file = file;
									callback(err);
								}
								return true;
							} else {
								caseInsensitiveMap.set(
									caseInsensitiveTargetPath,
									(similarEntry = {
										path: targetPath,
										source,
										size: undefined,
										waiting: undefined
									})
								);
								return false;
							}
						};

						/**
						 * get the binary (Buffer) content from the Source
						 * @returns {Buffer} content for the source
						 */
						const getContent = () => {
							if (typeof source.buffer === "function") {
								return source.buffer();
							} else {
								const bufferOrString = source.source();
								if (Buffer.isBuffer(bufferOrString)) {
									return bufferOrString;
								} else {
									return Buffer.from(bufferOrString, "utf8");
								}
							}
						};

						const alreadyWritten = () => {
							// cache the information that the Source has been already been written to that location
							if (targetFileGeneration === undefined) {
								const newGeneration = 1;
								this._assetEmittingWrittenFiles.set(targetPath, newGeneration);
								cacheEntry.writtenTo.set(targetPath, newGeneration);
							} else {
								cacheEntry.writtenTo.set(targetPath, targetFileGeneration);
							}
							callback();
						};

						/**
						 * Write the file to output file system
						 * @param {Buffer} content content to be written
						 * @returns {void}
						 */
						const doWrite = content => {
							// 将打包后的文件从内存中写入到本地
							this.outputFileSystem.writeFile(targetPath, content, err => {
								if (err) return callback(err);

								// information marker that the asset has been emitted
								compilation.emittedAssets.add(file);

								// cache the information that the Source has been written to that location
								const newGeneration =
									targetFileGeneration === undefined
										? 1
										: targetFileGeneration + 1;
								cacheEntry.writtenTo.set(targetPath, newGeneration);
								this._assetEmittingWrittenFiles.set(targetPath, newGeneration);
								this.hooks.assetEmitted.callAsync(
									file,
									{
										content,
										source,
										outputPath,
										compilation,
										targetPath
									},
									callback
								);
							});
						};

						const updateWithReplacementSource = size => {
							updateFileWithReplacementSource(file, cacheEntry, size);
							similarEntry.size = size;
							if (similarEntry.waiting !== undefined) {
								for (const { file, cacheEntry } of similarEntry.waiting) {
									updateFileWithReplacementSource(file, cacheEntry, size);
								}
							}
						};

						const updateFileWithReplacementSource = (
							file,
							cacheEntry,
							size
						) => {
							// Create a replacement resource which only allows to ask for size
							// This allows to GC all memory allocated by the Source
							// (expect when the Source is stored in any other cache)
							if (!cacheEntry.sizeOnlySource) {
								cacheEntry.sizeOnlySource = new SizeOnlySource(size);
							}
							compilation.updateAsset(file, cacheEntry.sizeOnlySource, {
								size
							});
						};

						const processExistingFile = stats => {
							// skip emitting if it's already there and an immutable file
							if (immutable) {
								updateWithReplacementSource(stats.size);
								return alreadyWritten();
							}

							const content = getContent();

							updateWithReplacementSource(content.length);

							// if it exists and content on disk matches content
							// skip writing the same content again
							// (to keep mtime and don't trigger watchers)
							// for a fast negative match file size is compared first
							if (content.length === stats.size) {
								compilation.comparedForEmitAssets.add(file);
								return this.outputFileSystem.readFile(
									targetPath,
									(err, existingContent) => {
										if (
											err ||
											!content.equals(// Buffer (existingContent))
										) {
											return doWrite(content);
										} else {
											return alreadyWritten();
										}
									}
								);
							}

							return doWrite(content);
						};

						const processMissingFile = () => {
							const content = getContent();

							updateWithReplacementSource(content.length);

							return doWrite(content);
						};

						// if the target file has already been written
						if (targetFileGeneration !== undefined) {
							// check if the Source has been written to this target file
							const writtenGeneration = cacheEntry.writtenTo.get(targetPath);
							if (writtenGeneration === targetFileGeneration) {
								// if yes, we may skip writing the file
								// if it's already there
								// (we assume one doesn't modify files while the Compiler is running, other then removing them)

								if (this._assetEmittingPreviousFiles.has(targetPath)) {
									// We assume that assets from the last compilation say intact on disk (they are not removed)
									compilation.updateAsset(file, cacheEntry.sizeOnlySource, {
										size: cacheEntry.sizeOnlySource.size()
									});

									return callback();
								} else {
									// Settings immutable will make it accept file content without comparing when file exist
									immutable = true;
								}
							} else if (!immutable) {
								if (checkSimilarFile()) return;
								// We wrote to this file before which has very likely a different content
								// skip comparing and assume content is different for performance
								// This case happens often during watch mode.
								return processMissingFile();
							}
						}

						if (checkSimilarFile()) return;
						if (this.options.output.compareBeforeEmit) {
							this.outputFileSystem.stat(targetPath, (err, stats) => {
								const exists = !err && stats.isFile();

								if (exists) {
									processExistingFile(stats);
								} else {
									processMissingFile();
								}
							});
						} else {
							// 解析缺失的文件
							processMissingFile();
						}
					};

					// 递归调用 构建目录层次
					if (targetFile.match(/\/|\\/)) {
						const fs = this.outputFileSystem;
						const dir = dirname(fs, join(fs, outputPath, targetFile));
						mkdirp(fs, dir, writeOut);
					} else {
						writeOut();
					}
				},
				err => {
					// Clear map to free up memory
					caseInsensitiveMap.clear();
					if (err) {
						this._assetEmittingPreviousFiles.clear();
						return callback(err);
					}

					this._assetEmittingPreviousFiles = allTargetPaths;

					// 直接执行回调
					this.hooks.afterEmit.callAsync(compilation, err => {
						if (err) return callback(err);

						return callback();
					});
				}
			);
		};

		// 直接执行回调
		this.hooks.emit.callAsync(compilation, err => {
			if (err) return callback(err);
			outputPath = compilation.getPath(this.outputPath, {});
			// 创建目录 并写入文件
			mkdirp(this.outputFileSystem, outputPath, emitFiles);
		});
	}

	// 将文件写入到缓存中
	emitRecords(callback) {
		if (!this.recordsOutputPath) return callback();

		// 写入文件
		const writeFile = () => {
			this.outputFileSystem.writeFile(
				this.recordsOutputPath,
				JSON.stringify(
					this.records,
					(n, value) => {
						if (
							typeof value === "object" &&
							value !== null &&
							!Array.isArray(value)
						) {
							const keys = Object.keys(value);
							if (!isSorted(keys)) {
								return sortObject(value, keys);
							}
						}
						return value;
					},
					2
				),
				callback
			);
		};

		// 获取文件目录
		const recordsOutputPathDirectory = dirname(
			this.outputFileSystem,
			this.recordsOutputPath
		);
		if (!recordsOutputPathDirectory) {
			return writeFile();
		}
		// 创建文件目录
		mkdirp(this.outputFileSystem, recordsOutputPathDirectory, err => {
			if (err) return callback(err);
			writeFile();
		});
	}

	// 读取缓存的记录
	readRecords(callback) {
		if (!this.recordsInputPath) {
			this.records = {};
			return callback();
		}
		this.inputFileSystem.stat(this.recordsInputPath, err => {
			// It doesn't exist
			// We can ignore this.
			if (err) return callback();

			this.inputFileSystem.readFile(this.recordsInputPath, (err, content) => {
				if (err) return callback(err);

				try {
					this.records = parseJson(content.toString("utf-8"));
				} catch (e) {
					e.message = "Cannot parse records: " + e.message;
					return callback(e);
				}

				return callback();
			});
		});
	}

	// 创建 子编译器
	createChildCompiler(
		compilation,
		compilerName,
		compilerIndex,
		outputOptions,
		plugins
	) {
		const childCompiler = new Compiler(this.context);
		childCompiler.name = compilerName;
		childCompiler.outputPath = this.outputPath;
		childCompiler.inputFileSystem = this.inputFileSystem;
		childCompiler.outputFileSystem = null;
		childCompiler.resolverFactory = this.resolverFactory;
		childCompiler.modifiedFiles = this.modifiedFiles;
		childCompiler.removedFiles = this.removedFiles;
		childCompiler.fileTimestamps = this.fileTimestamps;
		childCompiler.contextTimestamps = this.contextTimestamps;
		childCompiler.fsStartTime = this.fsStartTime;
		childCompiler.cache = this.cache;
		childCompiler.compilerPath = `${this.compilerPath}${compilerName}|${compilerIndex}|`;

		const relativeCompilerName = makePathsRelative(
			this.context,
			compilerName,
			this.root
		);
		if (!this.records[relativeCompilerName]) {
			this.records[relativeCompilerName] = [];
		}
		if (this.records[relativeCompilerName][compilerIndex]) {
			childCompiler.records = this.records[relativeCompilerName][compilerIndex];
		} else {
			this.records[relativeCompilerName].push((childCompiler.records = {}));
		}

		childCompiler.options = {
			...this.options,
			output: {
				...this.options.output,
				...outputOptions
			}
		};
		childCompiler.parentCompilation = compilation;
		childCompiler.root = this.root;
		if (Array.isArray(plugins)) {
			for (const plugin of plugins) {
				plugin.apply(childCompiler);
			}
		}
		for (const name in this.hooks) {
			if (
				![
					"make",
					"compile",
					"emit",
					"afterEmit",
					"invalid",
					"done",
					"thisCompilation"
				].includes(name)
			) {
				if (childCompiler.hooks[name]) {
					childCompiler.hooks[name].taps = this.hooks[name].taps.slice();
				}
			}
		}

		compilation.hooks.childCompiler.call(
			childCompiler,
			compilerName,
			compilerIndex
		);

		return childCompiler;
	}

	// 当前编译器是否是 子编译器
	isChild() {
		return !!this.parentCompilation;
	}

	// 返回创建的 Compilation 实例
	createCompilation() {
		this._cleanupLastCompilation();
		return (this._lastCompilation = new Compilation(this));
	}

	// 创建 Compilation 的实例 并注册插件compilation.hooks
	newCompilation(params) {
		const compilation = this.createCompilation();
		compilation.name = this.name;
		compilation.records = this.records;

		// TODO: 有空研究下 thisCompilation 和 compilation hook之间的区别
		// thisCompilation 和 compilation
		// 主要是给 compilation hooks 不同 hook 注册函数

		// 根据官方说明
		// 1. 当初始化compilation后 在发送compilation events前
		// 2. 此hooks 不会被复制到 child compilers中
		// 串行 使用插件
		// ArrayPushCallbackChunkFormatPlugin
		// JsonpChunkLoadingPlugin
		// StartupChunkDependenciesPlugin
		// ImportScriptsChunkLoadingPlugin
		// FetchCompileWasmPlugin
		// FetchCompileAsyncWasmPlugin
		// WorkerPlugin
		// SplitChunksPlugin
		// ResolverCachePlugin
		this.hooks.thisCompilation.call(compilation, params);

		// 串行使用插件
		// ChunkPrefetchPreloadPlugin
		// ModuleInfoHeaderPlugin
		// EvalDevToolModulePlugin
		// JavascriptModulesPlugin
		// JsonModulesPlugin
		// AssetModulesPlugin
		// EntryPlugin
		// RuntimePlugin
		// InferAsyncModulesPlugin
		// DataUriPlugin
		// FileUriPlugin
		// CompatibilityPlugin
		// HarmonyModulesPlugin
		// AMDPlugin
		// RequireJsStuffPlugin
		// CommonJsPlugin
		// LoaderPlugin
		// LoaderPlugin
		// NodeStuffPlugin
		// APIPlugin
		// ExportsInfoApiPlugin
		// WebpackIsIncludedPlugin
		// ConstPlugin
		// UseStrictPlugin

		// RequireIncludePlugin
		// RequireEnsurePlugin
		// RequireContextPlugin
		// ImportPlugin
		// SystemPlugin
		// ImportMetaPlugin
		// URLPlugin
		// DefaultStatsFactoryPlugin
		// DefaultStatsPresetPlugin
		// DefaultStatsPrinterPlugin
		// JavascriptMetaInfoPlugin
		// EnsureChunkConditionsPlugin
		// RemoveEmptyChunksPlugin
		// MergeDuplicateChunksPlugin
		// SideEffectsFlagPlugin
		// FlagDependencyExportsPlugin
		// NamedModuleIdsPlugin
		// NamedChunkIdsPlugin
		// DefinePlugin
		// TemplatedPathPlugin
		// RecordIdsPlugin
		// WarnCaseSensitiveModulesPlugin
		// 主要是给 compilation 不同的hook 注册事件
		this.hooks.compilation.call(compilation, params);

		return compilation;
	}

	// 返回 创建的 NormalModuleFactory 实例
	createNormalModuleFactory() {
		this._cleanupLastNormalModuleFactory();
		const normalModuleFactory = new NormalModuleFactory({
			context: this.options.context,
			fs: this.inputFileSystem,
			resolverFactory: this.resolverFactory,
			options: this.options.module,
			associatedObjectForCache: this.root,
			layers: this.options.experiments.layers
		});
		this._lastNormalModuleFactory = normalModuleFactory;

		// 空调用
		this.hooks.normalModuleFactory.call(normalModuleFactory);
		return normalModuleFactory;
	}

	// 返回创建的 ContextModuleFactory 实例
	createContextModuleFactory() {
		const contextModuleFactory = new ContextModuleFactory(this.resolverFactory);
		// 空调用
		this.hooks.contextModuleFactory.call(contextModuleFactory);
		return contextModuleFactory;
	}

	// 返回创建Compilation实例的params
	newCompilationParams() {
		const params = {
			normalModuleFactory: this.createNormalModuleFactory(),
			contextModuleFactory: this.createContextModuleFactory()
		};
		return params;
	}

	// 开始compilation编译
	compile(callback) {
		const params = this.newCompilationParams();
		// 直接执行回调
		this.hooks.beforeCompile.callAsync(params, err => {
			if (err) return callback(err);

			// ExternalsPlugin
			// normalModuleFactory.hooks.factorize 注册钩子
			// 主要时 从输出的bundle排除依赖(该依赖通过cdn的方式引入)
			this.hooks.compile.call(params);

			const compilation = this.newCompilation(params);

			const logger = compilation.getLogger("webpack.Compiler");

			logger.time("make hook");
			// EntryPlugin
			// compilation.addEntry
			// 添加入口 开始编译
			this.hooks.make.callAsync(compilation, err => {
				logger.timeEnd("make hook");
				if (err) return callback(err);
				logger.time("finish make hook");

				// 直接执行回调
				this.hooks.finishMake.callAsync(compilation, err => {
					logger.timeEnd("finish make hook");
					if (err) return callback(err);

					process.nextTick(() => {
						logger.time("finish compilation");
						compilation.finish(err => {
							logger.timeEnd("finish compilation");
							if (err) return callback(err);

							logger.time("seal compilation");
							compilation.seal(err => {
								logger.timeEnd("seal compilation");
								if (err) return callback(err);

								logger.time("afterCompile hook");

								// 直接执行回调
								this.hooks.afterCompile.callAsync(compilation, err => {
									logger.timeEnd("afterCompile hook");
									if (err) return callback(err);

									return callback(null, compilation);
								});
							});
						});
					});
				});
			});
		});
	}
	
	// 关闭编译
	close(callback) {
		// 直接执行回调
		this.hooks.shutdown.callAsync(err => {
			if (err) return callback(err);
			// Get rid of reference to last compilation to avoid leaking memory
			// We can't run this._cleanupLastCompilation() as the Stats to this compilation
			// might be still in use. We try to get rid of the reference to the cache instead.
			this._lastCompilation = undefined;
			this._lastNormalModuleFactory = undefined;
			this.cache.shutdown(callback);
		});
	}
}

module.exports = Compiler;
