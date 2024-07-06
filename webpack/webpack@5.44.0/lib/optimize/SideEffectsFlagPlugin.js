"use strict";

const glob2regexp = require("glob-to-regexp");
const { STAGE_DEFAULT } = require("../OptimizationStages");
const HarmonyExportImportedSpecifierDependency = require("../dependencies/HarmonyExportImportedSpecifierDependency");
const HarmonyImportSpecifierDependency = require("../dependencies/HarmonyImportSpecifierDependency");
const formatLocation = require("../formatLocation");

// WeakMap<any, Map<string, RegExp>>
const globToRegexpCache = new WeakMap();

// 返回 有路径创造的 正则表达式
const globToRegexp = (glob, cache) => {
	// glob: package.json 中 sideEffects 中匹配路径
	// cache: Map<String, RegExp>
	const cacheEntry = cache.get(glob);
	if (cacheEntry !== undefined) return cacheEntry;
	// 如果是单个文件 添加通配符路径
	if (!glob.includes("/")) {
		glob = `**/${glob}`;
	}
	const baseRegexp = glob2regexp(glob, { globstar: true, extended: true });
	const regexpSource = baseRegexp.source;
	// 添加相对路径
	const regexp = new RegExp("^(\\./)?" + regexpSource.slice(1));
	cache.set(glob, regexp);
	return regexp;
};

// 告诉 webpack 去辨识 package.json 中的 sideEffects 标记或规则，
// 以跳过那些当导出不被使用且被标记为不包含副作用的模块。
// 根据 模块 是否具有副作用 绑定 ModuleGraph._metaMap
// 根据 Webpack.options.optimization.sideEffects 注册该持剑
class SideEffectsFlagPlugin {
	constructor(analyseSource = true) {
		// Webpack.options.optimization.sideEffects
		// 表示: 是否要分析源代码的副作用
		this._analyseSource = analyseSource;
	}

	apply(compiler) {
		let cache = globToRegexpCache.get(compiler.root);
		if (cache === undefined) {
			cache = new Map();
			globToRegexpCache.set(compiler.root, cache);
		}
		compiler.hooks.compilation.tap(
			"SideEffectsFlagPlugin",
			(compilation, { normalModuleFactory }) => {
				const moduleGraph = compilation.moduleGraph;

				/**
				 * 根据 package.json 中的 sideEffects 字段 判断该模块路径是否有副作用
				 * 然后设置 Module.factoryMeta.sideEffectFree
				 */
				normalModuleFactory.hooks.module.tap(
					"SideEffectsFlagPlugin",
					(module, data) => {
						const resolveData = data.resourceResolveData;
						// resolveData.descriptionFileData 是读取 package.json 后返回的内容
						if (
							resolveData &&
							resolveData.descriptionFileData &&
							resolveData.relativePath
						) {
							// package.json sideEffects字段
							const sideEffects = resolveData.descriptionFileData.sideEffects;
							if (sideEffects !== undefined) {
								if (module.factoryMeta === undefined) {
									module.factoryMeta = {};
								}
								const hasSideEffects =
									SideEffectsFlagPlugin.moduleHasSideEffects(
										resolveData.relativePath,
										sideEffects,
										cache
									);
								module.factoryMeta.sideEffectFree = !hasSideEffects;
							}
						}

						return module;
					}
				);

				/**
				 * 根据 路径解析器 对 模块 解析后返回的数据 判断该模块是否有副作用
				 * 然后设置 Module.factoryMeta.sideEffectFree
				 */
				normalModuleFactory.hooks.module.tap(
					"SideEffectsFlagPlugin",
					(module, data) => {
						if (typeof data.settings.sideEffects === "boolean") {
							if (module.factoryMeta === undefined) {
								module.factoryMeta = {};
							}
							module.factoryMeta.sideEffectFree = !data.settings.sideEffects;
						}
						return module;
					}
				);

				// 分析源代码副作用
				if (this._analyseSource) {
					const parserHandler = parser => {
						let sideEffectsStatement;
						parser.hooks.program.tap("SideEffectsFlagPlugin", () => {
							sideEffectsStatement = undefined;
						});
						parser.hooks.statement.tap(
							{ name: "SideEffectsFlagPlugin", stage: -100 },
							statement => {
								if (sideEffectsStatement) return;
								if (parser.scope.topLevelScope !== true) return;
								switch (statement.type) {
									case "ExpressionStatement":
										if (
											!parser.isPure(statement.expression, statement.range[0])
										) {
											sideEffectsStatement = statement;
										}
										break;
									case "IfStatement":
									case "WhileStatement":
									case "DoWhileStatement":
										if (!parser.isPure(statement.test, statement.range[0])) {
											sideEffectsStatement = statement;
										}
										// statement hook will be called for child statements too
										break;
									case "ForStatement":
										if (
											!parser.isPure(statement.init, statement.range[0]) ||
											!parser.isPure(
												statement.test,
												statement.init
													? statement.init.range[1]
													: statement.range[0]
											) ||
											!parser.isPure(
												statement.update,
												statement.test
													? statement.test.range[1]
													: statement.init
													? statement.init.range[1]
													: statement.range[0]
											)
										) {
											sideEffectsStatement = statement;
										}
										// statement hook will be called for child statements too
										break;
									case "SwitchStatement":
										if (
											!parser.isPure(statement.discriminant, statement.range[0])
										) {
											sideEffectsStatement = statement;
										}
										// statement hook will be called for child statements too
										break;
									case "VariableDeclaration":
									case "ClassDeclaration":
									case "FunctionDeclaration":
										if (!parser.isPure(statement, statement.range[0])) {
											sideEffectsStatement = statement;
										}
										break;
									case "ExportNamedDeclaration":
									case "ExportDefaultDeclaration":
										if (
											!parser.isPure(statement.declaration, statement.range[0])
										) {
											sideEffectsStatement = statement;
										}
										break;
									case "LabeledStatement":
									case "BlockStatement":
										// statement hook will be called for child statements too
										break;
									case "EmptyStatement":
										break;
									case "ExportAllDeclaration":
									case "ImportDeclaration":
										// imports will be handled by the dependencies
										break;
									default:
										sideEffectsStatement = statement;
										break;
								}
							}
						);
						parser.hooks.finish.tap("SideEffectsFlagPlugin", () => {
							if (sideEffectsStatement === undefined) {
								parser.state.module.buildMeta.sideEffectFree = true;
							} else {
								const { loc, type } = sideEffectsStatement;
								moduleGraph
									.getOptimizationBailout(parser.state.module)
									.push(
										() =>
											`Statement (${type}) with side effects in source code at ${formatLocation(
												loc
											)}`
									);
							}
						});
					};
					for (const key of [
						"javascript/auto",
						"javascript/esm",
						"javascript/dynamic"
					]) {
						normalModuleFactory.hooks.parser
							.for(key)
							.tap("SideEffectsFlagPlugin", parserHandler);
					}
				}

				/**
				 * 
				 */
				compilation.hooks.optimizeDependencies.tap(
					{
						name: "SideEffectsFlagPlugin",
						stage: STAGE_DEFAULT
					},
					modules => {
						const logger = compilation.getLogger(
							"webpack.SideEffectsFlagPlugin"
						);

						logger.time("update dependencies");
						for (const module of modules) {
							if (module.getSideEffectsConnectionState(moduleGraph) === false) {
								const exportsInfo = moduleGraph.getExportsInfo(module);
								for (const connection of moduleGraph.getIncomingConnections(
									module
								)) {
									const dep = connection.dependency;
									let isReexport;
									if (
										(isReexport =
											dep instanceof
											HarmonyExportImportedSpecifierDependency) ||
										(dep instanceof HarmonyImportSpecifierDependency &&
											!dep.namespaceObjectAsContext)
									) {
										// TODO improve for export *
										if (isReexport && dep.name) {
											const exportInfo = moduleGraph.getExportInfo(
												connection.originModule,
												dep.name
											);
											exportInfo.moveTarget(
												moduleGraph,
												({ module }) =>
													module.getSideEffectsConnectionState(moduleGraph) ===
													false,
												({ module: newModule, export: exportName }) => {
													moduleGraph.updateModule(dep, newModule);
													moduleGraph.addExplanation(
														dep,
														"(skipped side-effect-free modules)"
													);
													const ids = dep.getIds(moduleGraph);
													dep.setIds(
														moduleGraph,
														exportName
															? [...exportName, ...ids.slice(1)]
															: ids.slice(1)
													);
													return moduleGraph.getConnection(dep);
												}
											);
											continue;
										}
										// TODO improve for nested imports
										const ids = dep.getIds(moduleGraph);
										if (ids.length > 0) {
											const exportInfo = exportsInfo.getExportInfo(ids[0]);
											const target = exportInfo.getTarget(
												moduleGraph,
												({ module }) =>
													module.getSideEffectsConnectionState(moduleGraph) ===
													false
											);
											if (!target) continue;

											moduleGraph.updateModule(dep, target.module);
											moduleGraph.addExplanation(
												dep,
												"(skipped side-effect-free modules)"
											);
											dep.setIds(
												moduleGraph,
												target.export
													? [...target.export, ...ids.slice(1)]
													: ids.slice(1)
											);
										}
									}
								}
							}
						}
						logger.timeEnd("update dependencies");
					}
				);
			}
		);
	}

	// 根据 package.json 中的 sideEffects 字段 判断该模块路径是否有副作用
	static moduleHasSideEffects(moduleName, flagValue, cache) {
		switch (typeof flagValue) {
			case "undefined":
				return true;
			case "boolean":
				return flagValue;
			case "string":
				return globToRegexp(flagValue, cache).test(moduleName);
			case "object":
				return flagValue.some(glob =>
					SideEffectsFlagPlugin.moduleHasSideEffects(moduleName, glob, cache)
				);
		}
	}
}
module.exports = SideEffectsFlagPlugin;
