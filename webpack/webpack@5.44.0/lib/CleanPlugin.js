"use strict";

const asyncLib = require("neo-async");
const { SyncBailHook } = require("tapable");
const Compilation = require("../lib/Compilation");
const createSchemaValidation = require("./util/create-schema-validation");
const { join } = require("./util/fs");
const processAsyncTree = require("./util/processAsyncTree");

// 验证 CleanPlugin.options
const validate = createSchemaValidation(
	undefined,
	() => {
		const { definitions } = require("../schemas/WebpackOptions.json");
		return {
			definitions,
			oneOf: [{ $ref: "#/definitions/CleanOptions" }]
		};
	},
	{
		name: "Clean Plugin",
		baseDataPath: "options"
	}
);

// 根据 目录 和 资源路径 来获取 最终的资源路径
const getDiffToFs = (fs, outputPath, currentAssets, callback) => {
	const directories = new Set();
	// get directories of assets
	for (const asset of currentAssets) {
		directories.add(asset.replace(/(^|\/)[^/]*$/, ""));
	}
	// and all parent directories
	for (const directory of directories) {
		directories.add(directory.replace(/(^|\/)[^/]*$/, ""));
	}
	const diff = new Set();
	asyncLib.forEachLimit(
		directories,
		10,
		(directory, callback) => {
			fs.readdir(join(fs, outputPath, directory), (err, entries) => {
				if (err) {
					if (err.code === "ENOENT") return callback();
					// 读取的是资源路径 不是资源目录
					if (err.code === "ENOTDIR") {
						diff.add(directory);
						return callback();
					}
					return callback(err);
				}
				for (const entry of entries) {
					const file = /** @type {string} */ (entry);
					const filename = directory ? `${directory}/${file}` : file;
					if (!directories.has(filename) && !currentAssets.has(filename)) {
						diff.add(filename);
					}
				}
				callback();
			});
		},
		err => {
			if (err) return callback(err);

			callback(null, diff);
		}
	);
};

// 对比所有的 新资源路径 和 旧资源路径 返回最终的资源路径
const getDiffToOldAssets = (currentAssets, oldAssets) => {
	const diff = new Set();
	for (const asset of oldAssets) {
		if (!currentAssets.has(asset)) diff.add(asset);
	}
	return diff;
};

// 对 最终的资源路径 进行处理(删除)
const applyDiff = (fs, outputPath, dry, logger, diff, isKept, callback) => {
	const log = msg => {
		if (dry) {
			logger.info(msg);
		} else {
			logger.log(msg);
		}
	};
	/** @typedef {{ type: "check" | "unlink" | "rmdir", filename: string, parent: { remaining: number, job: Job } | undefined }} Job */
	/** @type {Job[]} */
	const jobs = Array.from(diff, filename => ({
		type: "check",
		filename,
		parent: undefined
	}));
	processAsyncTree(
		jobs,
		10,
		({ type, filename, parent }, push, callback) => {
			const handleError = err => {
				if (err.code === "ENOENT") {
					log(`${filename} was removed during cleaning by something else`);
					handleParent();
					return callback();
				}
				return callback(err);
			};
			const handleParent = () => {
				if (parent && --parent.remaining === 0) push(parent.job);
			};
			const path = join(fs, outputPath, filename);
			switch (type) {
				case "check":
					if (isKept(filename)) {
						// do not decrement parent entry as we don't want to delete the parent
						log(`${filename} will be kept`);
						return process.nextTick(callback);
					}
					fs.stat(path, (err, stats) => {
						if (err) return handleError(err);
						if (!stats.isDirectory()) {
							push({
								type: "unlink",
								filename,
								parent
							});
							return callback();
						}
						fs.readdir(path, (err, entries) => {
							if (err) return handleError(err);
							/** @type {Job} */
							const deleteJob = {
								type: "rmdir",
								filename,
								parent
							};
							if (entries.length === 0) {
								push(deleteJob);
							} else {
								const parentToken = {
									remaining: entries.length,
									job: deleteJob
								};
								for (const entry of entries) {
									const file = /** @type {string} */ (entry);
									if (file.startsWith(".")) {
										log(
											`${filename} will be kept (dot-files will never be removed)`
										);
										continue;
									}
									push({
										type: "check",
										filename: `${filename}/${file}`,
										parent: parentToken
									});
								}
							}
							return callback();
						});
					});
					break;
				case "rmdir":
					log(`${filename} will be removed`);
					if (dry) {
						handleParent();
						return process.nextTick(callback);
					}
					if (!fs.rmdir) {
						logger.warn(
							`${filename} can't be removed because output file system doesn't support removing directories (rmdir)`
						);
						return process.nextTick(callback);
					}
					fs.rmdir(path, err => {
						if (err) return handleError(err);
						handleParent();
						callback();
					});
					break;
				case "unlink":
					log(`${filename} will be removed`);
					if (dry) {
						handleParent();
						return process.nextTick(callback);
					}
					if (!fs.unlink) {
						logger.warn(
							`${filename} can't be removed because output file system doesn't support removing files (rmdir)`
						);
						return process.nextTick(callback);
					}
					fs.unlink(path, err => {
						if (err) return handleError(err);
						handleParent();
						callback();
					});
					break;
			}
		},
		callback
	);
};

// WeakMap<Compilation, Hooks>
const compilationHooksMap = new WeakMap();

// 清空插件
// 作用:
// 在生成文件之前 清空 output 目录
class CleanPlugin {
	static getCompilationHooks(compilation) {
		if (!(compilation instanceof Compilation)) {
			throw new TypeError(
				"The 'compilation' argument must be an instance of Compilation"
			);
		}
		let hooks = compilationHooksMap.get(compilation);
		if (hooks === undefined) {
			hooks = {
				// SyncBailHook<[string], boolean>}
				keep: new SyncBailHook(["ignore"])
			};
			compilationHooksMap.set(compilation, hooks);
		}
		return hooks;
	}

	// Webpack.options.output.clean
	constructor(options = {}) {
		validate(options);
		this.options = { dry: false, ...options };
	}

	apply(compiler) {
		const { dry, keep } = this.options;

		const keepFn =
			typeof keep === "function"
				? keep
				: typeof keep === "string"
				? path => path.startsWith(keep)
				: typeof keep === "object" && keep.test
				? path => keep.test(path)
				: () => false;

		// We assume that no external modification happens while the compiler is active
		// So we can store the old assets and only diff to them to avoid fs access on
		// incremental builds
		let oldAssets;

		compiler.hooks.emit.tapAsync(
			{
				name: "CleanPlugin",
				stage: 100
			},
			(compilation, callback) => {
				const hooks = CleanPlugin.getCompilationHooks(compilation);
				const logger = compilation.getLogger("webpack.CleanPlugin");
				const fs = compiler.outputFileSystem;

				if (!fs.readdir) {
					return callback(
						new Error(
							"CleanPlugin: Output filesystem doesn't support listing directories (readdir)"
						)
					);
				}

				const currentAssets = new Set();
				for (const asset of Object.keys(compilation.assets)) {
					if (/^[A-Za-z]:\\|^\/|^\\\\/.test(asset)) continue;
					let normalizedAsset;
					// window 环境资源路径
					let newNormalizedAsset = asset.replace(/\\/g, "/");
					do {
						normalizedAsset = newNormalizedAsset;
						newNormalizedAsset = normalizedAsset.replace(
							/(^|\/)(?!\.\.)[^/]+\/\.\.\//g,
							"$1"
						);
					} while (newNormalizedAsset !== normalizedAsset);
					if (normalizedAsset.startsWith("../")) continue;
					currentAssets.add(normalizedAsset);
				}

				const outputPath = compilation.getPath(compiler.outputPath, {});

				const isKept = path => {
					const result = hooks.keep.call(path);
					if (result !== undefined) return result;
					return keepFn(path);
				};

				const diffCallback = (err, diff) => {
					if (err) {
						oldAssets = undefined;
						return callback(err);
					}
					applyDiff(fs, outputPath, dry, logger, diff, isKept, err => {
						if (err) {
							oldAssets = undefined;
						} else {
							oldAssets = currentAssets;
						}
						callback(err);
					});
				};

				if (oldAssets) {
					diffCallback(null, getDiffToOldAssets(currentAssets, oldAssets));
				} else {
					getDiffToFs(fs, outputPath, currentAssets, diffCallback);
				}
			}
		);
	}
}

module.exports = CleanPlugin;
