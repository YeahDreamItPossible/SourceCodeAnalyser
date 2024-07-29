"use strict";

const asyncLib = require("neo-async");
const Queue = require("./util/Queue");

// 根据 Webpack.options.optimization.providedExports = true 注册该插件
// 标记依赖导出插件
// 作用:
// 告知 webpack 去确定那些由模块提供的导出内容，为 export * from ... 生成更多高效的代码。
// 默认 optimization.providedExports 会被启用。
class FlagDependencyExportsPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"FlagDependencyExportsPlugin",
			compilation => {
				const moduleGraph = compilation.moduleGraph;
				const cache = compilation.getCache("FlagDependencyExportsPlugin");
				compilation.hooks.finishModules.tapAsync(
					"FlagDependencyExportsPlugin",
					(modules, callback) => {
						const logger = compilation.getLogger(
							"webpack.FlagDependencyExportsPlugin"
						);
						// 需要重新被缓存的模块数量
						let statRestoredFromCache = 0;
						// 没有声明导出标识符的模块数量
						let statNoExports = 0;
						// 不需要缓存的模块数量
						let statFlaggedUncached = 0;
						// 
						let statNotCached = 0;
						// 被解析的模块数量
						let statQueueItemsProcessed = 0;

						/** @type {Queue<Module>} */
						const queue = new Queue();

						// Step 1: Try to restore cached provided export info from cache
						// 
						logger.time("restore cached provided exports");
						asyncLib.each(
							modules,
							(module, callback) => {
								const exportsInfo = moduleGraph.getExportsInfo(module);
								if (!module.buildMeta || !module.buildMeta.exportsType) {
									// 当模块没有 任何导出语句 时
									if (exportsInfo.otherExportsInfo.provided !== null) {
										// It's a module without declared exports
										statNoExports++;
										exportsInfo.setHasProvideInfo();
										exportsInfo.setUnknownExportsProvided();
										return callback();
									}
								}
								if (
									module.buildInfo.cacheable !== true ||
									typeof module.buildInfo.hash !== "string"
								) {
									statFlaggedUncached++;
									// Enqueue uncacheable module for determining the exports
									queue.enqueue(module);
									exportsInfo.setHasProvideInfo();
									return callback();
								}
								cache.get(
									module.identifier(),
									module.buildInfo.hash,
									(err, result) => {
										if (err) return callback(err);

										if (result !== undefined) {
											statRestoredFromCache++;
											moduleGraph
												.getExportsInfo(module)
												.restoreProvided(result);
										} else {
											statNotCached++;
											// Without cached info enqueue module for determining the exports
											queue.enqueue(module);
											exportsInfo.setHasProvideInfo();
										}
										callback();
									}
								);
							},
							err => {
								logger.timeEnd("restore cached provided exports");
								if (err) return callback(err);

								// 需要被缓存的模块
								// Set<Module>
								const modulesToStore = new Set();

								// Map<Module, Set<Module>>
								const dependencies = new Map();

								let module;

								let exportsInfo;

								// 
								// Map<Dependency, ExportsSpec>
								const exportsSpecsFromDependencies = new Map();

								let cacheable = true;
								let changed = false;

								// 处理 依赖块 和 依赖中的 导出信息
								const processDependenciesBlock = depBlock => {
									for (const dep of depBlock.dependencies) {
										processDependency(dep);
									}
									for (const block of depBlock.blocks) {
										processDependenciesBlock(block);
									}
								};

								// 处理 依赖 中的导出信息
								const processDependency = dep => {
									const exportDesc = dep.getExports(moduleGraph);
									if (!exportDesc) return;
									exportsSpecsFromDependencies.set(dep, exportDesc);
								};

								// 处理 依赖 中的导出信息
								const processExportsSpec = (dep, exportDesc) => {
									const exports = exportDesc.exports;
									const globalCanMangle = exportDesc.canMangle;
									const globalFrom = exportDesc.from;
									const globalPriority = exportDesc.priority;
									const globalTerminalBinding =
										exportDesc.terminalBinding || false;
									const exportDeps = exportDesc.dependencies;
									if (exportDesc.hideExports) {
										for (const name of exportDesc.hideExports) {
											const exportInfo = exportsInfo.getExportInfo(name);
											exportInfo.unsetTarget(dep);
										}
									}
									if (exports === true) {
										// unknown exports
										if (
											exportsInfo.setUnknownExportsProvided(
												globalCanMangle,
												exportDesc.excludeExports,
												globalFrom && dep,
												globalFrom,
												globalPriority
											)
										) {
											changed = true;
										}
									} else if (Array.isArray(exports)) {
										/**
										 * merge in new exports
										 * @param {ExportsInfo} exportsInfo own exports info
										 * @param {(ExportSpec | string)[]} exports list of exports
										 */
										const mergeExports = (exportsInfo, exports) => {
											for (const exportNameOrSpec of exports) {
												let name;
												let canMangle = globalCanMangle;
												let terminalBinding = globalTerminalBinding;
												let exports = undefined;
												let from = globalFrom;
												let fromExport = undefined;
												let priority = globalPriority;
												let hidden = false;
												if (typeof exportNameOrSpec === "string") {
													name = exportNameOrSpec;
												} else {
													name = exportNameOrSpec.name;
													if (exportNameOrSpec.canMangle !== undefined)
														canMangle = exportNameOrSpec.canMangle;
													if (exportNameOrSpec.export !== undefined)
														fromExport = exportNameOrSpec.export;
													if (exportNameOrSpec.exports !== undefined)
														exports = exportNameOrSpec.exports;
													if (exportNameOrSpec.from !== undefined)
														from = exportNameOrSpec.from;
													if (exportNameOrSpec.priority !== undefined)
														priority = exportNameOrSpec.priority;
													if (exportNameOrSpec.terminalBinding !== undefined)
														terminalBinding = exportNameOrSpec.terminalBinding;
													if (exportNameOrSpec.hidden !== undefined)
														hidden = exportNameOrSpec.hidden;
												}
												const exportInfo = exportsInfo.getExportInfo(name);

												if (
													exportInfo.provided === false ||
													exportInfo.provided === null
												) {
													exportInfo.provided = true;
													changed = true;
												}

												if (
													exportInfo.canMangleProvide !== false &&
													canMangle === false
												) {
													exportInfo.canMangleProvide = false;
													changed = true;
												}

												if (terminalBinding && !exportInfo.terminalBinding) {
													exportInfo.terminalBinding = true;
													changed = true;
												}

												if (exports) {
													const nestedExportsInfo =
														exportInfo.createNestedExportsInfo();
													mergeExports(nestedExportsInfo, exports);
												}

												if (
													from &&
													(hidden
														? exportInfo.unsetTarget(dep)
														: exportInfo.setTarget(
																dep,
																from,
																fromExport === undefined ? [name] : fromExport,
																priority
														  ))
												) {
													changed = true;
												}

												// Recalculate target exportsInfo
												const target = exportInfo.getTarget(moduleGraph);
												let targetExportsInfo = undefined;
												if (target) {
													const targetModuleExportsInfo =
														moduleGraph.getExportsInfo(target.module);
													targetExportsInfo =
														targetModuleExportsInfo.getNestedExportsInfo(
															target.export
														);
													// add dependency for this module
													const set = dependencies.get(target.module);
													if (set === undefined) {
														dependencies.set(target.module, new Set([module]));
													} else {
														set.add(module);
													}
												}

												if (exportInfo.exportsInfoOwned) {
													if (
														exportInfo.exportsInfo.setRedirectNamedTo(
															targetExportsInfo
														)
													) {
														changed = true;
													}
												} else if (
													exportInfo.exportsInfo !== targetExportsInfo
												) {
													exportInfo.exportsInfo = targetExportsInfo;
													changed = true;
												}
											}
										};
										mergeExports(exportsInfo, exports);
									}
									// store dependencies
									if (exportDeps) {
										cacheable = false;
										for (const exportDependency of exportDeps) {
											// add dependency for this module
											const set = dependencies.get(exportDependency);
											if (set === undefined) {
												dependencies.set(exportDependency, new Set([module]));
											} else {
												set.add(module);
											}
										}
									}
								};

								// 
								const notifyDependencies = () => {
									const deps = dependencies.get(module);
									if (deps !== undefined) {
										for (const dep of deps) {
											queue.enqueue(dep);
										}
									}
								};

								logger.time("figure out provided exports");
								while (queue.length > 0) {
									module = queue.dequeue();

									statQueueItemsProcessed++;

									exportsInfo = moduleGraph.getExportsInfo(module);

									cacheable = true;
									changed = false;

									exportsSpecsFromDependencies.clear();
									moduleGraph.freeze();
									processDependenciesBlock(module);
									moduleGraph.unfreeze();
									for (const [
										dep,
										exportsSpec
									] of exportsSpecsFromDependencies) {
										processExportsSpec(dep, exportsSpec);
									}

									if (cacheable) {
										modulesToStore.add(module);
									}

									if (changed) {
										notifyDependencies();
									}
								}
								logger.timeEnd("figure out provided exports");

								logger.log(
									`${Math.round(
										(100 * (statFlaggedUncached + statNotCached)) /
											(statRestoredFromCache +
												statNotCached +
												statFlaggedUncached +
												statNoExports)
									)}% of exports of modules have been determined (${statNoExports} no declared exports, ${statNotCached} not cached, ${statFlaggedUncached} flagged uncacheable, ${statRestoredFromCache} from cache, ${
										statQueueItemsProcessed -
										statNotCached -
										statFlaggedUncached
									} additional calculations due to dependencies)`
								);

								logger.time("store provided exports into cache");
								asyncLib.each(
									modulesToStore,
									(module, callback) => {
										// 当 模块 不需要缓存时 或者 模块构建hash 不存在时
										// 则 不需要缓存模块
										if (
											module.buildInfo.cacheable !== true ||
											typeof module.buildInfo.hash !== "string"
										) {
											// not cacheable
											return callback();
										}
										// 缓存模块
										cache.store(
											module.identifier(),
											module.buildInfo.hash,
											moduleGraph
												.getExportsInfo(module)
												.getRestoreProvidedData(),
											callback
										);
									},
									err => {
										logger.timeEnd("store provided exports into cache");
										callback(err);
									}
								);
							}
						);
					}
				);

				// WeakMap<Module, any>
				const providedExportsCache = new WeakMap();
				compilation.hooks.rebuildModule.tap(
					"FlagDependencyExportsPlugin",
					module => {
						providedExportsCache.set(
							module,
							moduleGraph.getExportsInfo(module).getRestoreProvidedData()
						);
					}
				);
				compilation.hooks.finishRebuildingModule.tap(
					"FlagDependencyExportsPlugin",
					module => {
						moduleGraph
							.getExportsInfo(module)
							.restoreProvided(providedExportsCache.get(module));
					}
				);
			}
		);
	}
}

module.exports = FlagDependencyExportsPlugin;
