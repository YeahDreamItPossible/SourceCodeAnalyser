// @ts-nocheck
"use strict";

const InitFragment = require("./InitFragment");
const RuntimeGlobals = require("./RuntimeGlobals");
const Template = require("./Template");
const { equals } = require("./util/ArrayHelpers");
const compileBooleanMatcher = require("./util/compileBooleanMatcher");
const propertyAccess = require("./util/propertyAccess");
const { forEachRuntime, subtractRuntime } = require("./util/runtime");

const noModuleIdErrorMessage = (module, chunkGraph) => {
	return `Module ${module.identifier()} has no id assigned.
This should not happen.
It's in these chunks: ${
		Array.from(
			chunkGraph.getModuleChunksIterable(module),
			c => c.name || c.id || c.debugId
		).join(", ") || "none"
	} (If module is in no chunk this indicates a bug in some chunk/module optimization logic)
Module has these incoming connections: ${Array.from(
		chunkGraph.moduleGraph.getIncomingConnections(module),
		connection =>
			`\n - ${
				connection.originModule && connection.originModule.identifier()
			} ${connection.dependency && connection.dependency.type} ${
				(connection.explanations &&
					Array.from(connection.explanations).join(", ")) ||
				""
			}`
	).join("")}`;
};

// 运行时模板
class RuntimeTemplate {
	constructor(compilation, outputOptions, requestShortener) {
		this.compilation = compilation;
		// Webpack.options.output
		this.outputOptions = outputOptions || {};
		// 路径缩短器
		this.requestShortener = requestShortener;
	}

	// 是否支持 IIFE
	isIIFE() {
		return this.outputOptions.iife;
	}

	// 是否以模块类型输出Javascript文件
	isModule() {
		return this.outputOptions.module;
	}

	// 是否支持 const 关键字
	supportsConst() {
		return this.outputOptions.environment.const;
	}

	// 是否支持箭头函数
	supportsArrowFunction() {
		return this.outputOptions.environment.arrowFunction;
	}

	// 是否支持 forOf 语句
	supportsForOf() {
		return this.outputOptions.environment.forOf;
	}

	// 是否支持 解构赋值 语句
	supportsDestructuring() {
		return this.outputOptions.environment.destructuring;
	}

	// 是否支持 BigInt 字面量
	supportsBigIntLiteral() {
		return this.outputOptions.environment.bigIntLiteral;
	}

	// 是否支持 es6 动态导入(import()) 语句
	supportsDynamicImport() {
		return this.outputOptions.environment.dynamicImport;
	}

	// 是否支持 ECMAScript Module syntax(import * from '...')
	supportsEcmaScriptModuleSyntax() {
		return this.outputOptions.environment.module;
	}

	// 是否支持 模板字面量
	supportTemplateLiteral() {
		// TODO
		return false;
	}

	// 返回带有返回值的函数代码
	// 如果当前运行环境支持箭头函数 则返回箭头函数 否则返回普通函数
	returningFunction(returnValue, args = "") {
		return this.supportsArrowFunction()
			? `(${args}) => (${returnValue})`
			: `function(${args}) { return ${returnValue}; }`;
	}

	// 返回基础函数代码(没有返回值)
	// 如果当前运行环境支持箭头函数 则返回箭头函数 否则返回普通函数
	basicFunction(args, body) {
		return this.supportsArrowFunction()
			? `(${args}) => {\n${Template.indent(body)}\n}`
			: `function(${args}) {\n${Template.indent(body)}\n}`;
	}

	// 返回表达式函数代码
	// 如果当前运行环境支持箭头函数 则返回箭头函数 否则返回普通函数
	expressionFunction(expression, args = "") {
		return this.supportsArrowFunction()
			? `(${args}) => (${expression})`
			: `function(${args}) { ${expression}; }`;
	}

	// 返回空函数代码
	// 如果当前运行环境支持箭头函数 则返回箭头函数 否则返回普通函数
	emptyFunction() {
		return this.supportsArrowFunction() ? "x => {}" : "function() {}";
	}

	// 返回 数组解构赋值 语句
	destructureArray(items, value) {
		return this.supportsDestructuring()
			? `var [${items.join(", ")}] = ${value};`
			: Template.asString(
					items.map((item, i) => `var ${item} = ${value}[${i}];`)
			  );
	}

	// 返回 对象解构赋值 语句
	destructureObject(items, value) {
		return this.supportsDestructuring()
			? `var {${items.join(", ")}} = ${value};`
			: Template.asString(
					items.map(item => `var ${item} = ${value}${propertyAccess([item])};`)
			  );
	}

	// 返回 IIFE 代码块
	iife(args, body) {
		return `(${this.basicFunction(args, body)})()`;
	}

	// 返回 forEach 代码
	forEach(variable, array, body) {
		return this.supportsForOf()
			? `for(const ${variable} of ${array}) {\n${Template.indent(body)}\n}`
			: `${array}.forEach(function(${variable}) {\n${Template.indent(
					body
			  )}\n});`;
	}

	// 返回 注释代码
	comment({ request, chunkName, chunkReason, message, exportName }) {
		let content;
		if (this.outputOptions.pathinfo) {
			content = [message, request, chunkName, chunkReason]
				.filter(Boolean)
				.map(item => this.requestShortener.shorten(item))
				.join(" | ");
		} else {
			content = [message, chunkName, chunkReason]
				.filter(Boolean)
				.map(item => this.requestShortener.shorten(item))
				.join(" | ");
		}
		if (!content) return "";
		if (this.outputOptions.pathinfo) {
			return Template.toComment(content) + " ";
		} else {
			return Template.toNormalComment(content) + " ";
		}
	}

	// 返回 错误代码块
	throwMissingModuleErrorBlock({ request }) {
		const err = `Cannot find module '${request}'`;
		return `var e = new Error(${JSON.stringify(
			err
		)}); e.code = 'MODULE_NOT_FOUND'; throw e;`;
	}

	// 返回 缺失模块错误函数
	throwMissingModuleErrorFunction({ request }) {
		return `function webpackMissingModule() { ${this.throwMissingModuleErrorBlock(
			{ request }
		)} }`;
	}

	// 返回 缺失模块自调用函数
	missingModule({ request }) {
		return `Object(${this.throwMissingModuleErrorFunction({ request })}())`;
	}

	// 返回 缺失模块自调用函数 语句
	missingModuleStatement({ request }) {
		return `${this.missingModule({ request })};\n`;
	}

	// 返回 缺失模块自调用函数 Promise
	missingModulePromise({ request }) {
		return `Promise.resolve().then(${this.throwMissingModuleErrorFunction({
			request
		})})`;
	}

	// 返回 模块不可用 代码
	weakError({ module, chunkGraph, request, idExpr, type }) {
		const moduleId = chunkGraph.getModuleId(module);
		const errorMessage =
			moduleId === null
				? JSON.stringify("Module is not available (weak dependency)")
				: idExpr
				? `"Module '" + ${idExpr} + "' is not available (weak dependency)"`
				: JSON.stringify(
						`Module '${moduleId}' is not available (weak dependency)`
				  );
		const comment = request ? Template.toNormalComment(request) + " " : "";
		const errorStatements =
			`var e = new Error(${errorMessage}); ` +
			comment +
			"e.code = 'MODULE_NOT_FOUND'; throw e;";
		switch (type) {
			case "statements":
				return errorStatements;
			case "promise":
				return `Promise.resolve().then(${this.basicFunction(
					"",
					errorStatements
				)})`;
			case "expression":
				return this.iife("", errorStatements);
		}
	}

	// 返回 带注释 的 序列化后的模块路径字符串
	// 示例: /*! ./imgs/cache.png */ "./src/imgs/cache.png"
	// 用于 __webpack_require__(/*! ./imgs/cache.png */ "./src/imgs/cache.png")
	moduleId({ module, chunkGraph, request, weak }) {
		if (!module) {
			return this.missingModule({
				request
			});
		}
		const moduleId = chunkGraph.getModuleId(module);
		if (moduleId === null) {
			if (weak) {
				return "null /* weak dependency, without id */";
			}
			throw new Error(
				`RuntimeTemplate.moduleId(): ${noModuleIdErrorMessage(
					module,
					chunkGraph
				)}`
			);
		}
		return `${this.comment({ request })}${JSON.stringify(moduleId)}`;
	}

	// 返回 模块加载字符串
	// 示例: __webpack_require__(/*! ./imgs/cache.png */ \"./src/imgs/cache.png\")
	moduleRaw({ module, chunkGraph, request, weak, runtimeRequirements }) {
		if (!module) {
			return this.missingModule({
				request
			});
		}
		const moduleId = chunkGraph.getModuleId(module);
		if (moduleId === null) {
			if (weak) {
				// only weak referenced modules don't get an id
				// we can always emit an error emitting code here
				return this.weakError({
					module,
					chunkGraph,
					request,
					type: "expression"
				});
			}
			throw new Error(
				`RuntimeTemplate.moduleId(): ${noModuleIdErrorMessage(
					module,
					chunkGraph
				)}`
			);
		}
		runtimeRequirements.add(RuntimeGlobals.require);
		return `__webpack_require__(${this.moduleId({
			module,
			chunkGraph,
			request,
			weak
		})})`;
	}

	// 返回 模块加载字符串
	moduleExports({ module, chunkGraph, request, weak, runtimeRequirements }) {
		return this.moduleRaw({
			module,
			chunkGraph,
			request,
			weak,
			runtimeRequirements
		});
	}

	// 返回 不同类型的 模块加载字符串
	moduleNamespace({
		module,
		chunkGraph,
		request,
		strict,
		weak,
		runtimeRequirements
	}) {
		if (!module) {
			return this.missingModule({
				request
			});
		}
		if (chunkGraph.getModuleId(module) === null) {
			if (weak) {
				// only weak referenced modules don't get an id
				// we can always emit an error emitting code here
				return this.weakError({
					module,
					chunkGraph,
					request,
					type: "expression"
				});
			}
			throw new Error(
				`RuntimeTemplate.moduleNamespace(): ${noModuleIdErrorMessage(
					module,
					chunkGraph
				)}`
			);
		}
		const moduleId = this.moduleId({
			module,
			chunkGraph,
			request,
			weak
		});
		const exportsType = module.getExportsType(chunkGraph.moduleGraph, strict);
		switch (exportsType) {
			case "namespace":
				return this.moduleRaw({
					module,
					chunkGraph,
					request,
					weak,
					runtimeRequirements
				});
			case "default-with-named":
				runtimeRequirements.add(RuntimeGlobals.createFakeNamespaceObject);
				return `${RuntimeGlobals.createFakeNamespaceObject}(${moduleId}, 3)`;
			case "default-only":
				runtimeRequirements.add(RuntimeGlobals.createFakeNamespaceObject);
				return `${RuntimeGlobals.createFakeNamespaceObject}(${moduleId}, 1)`;
			case "dynamic":
				runtimeRequirements.add(RuntimeGlobals.createFakeNamespaceObject);
				return `${RuntimeGlobals.createFakeNamespaceObject}(${moduleId}, 7)`;
		}
	}

	// TODO:
	// 
	moduleNamespacePromise({
		chunkGraph,
		block,
		module,
		request,
		message,
		strict,
		weak,
		runtimeRequirements
	}) {
		if (!module) {
			return this.missingModulePromise({
				request
			});
		}
		const moduleId = chunkGraph.getModuleId(module);
		if (moduleId === null) {
			if (weak) {
				// only weak referenced modules don't get an id
				// we can always emit an error emitting code here
				return this.weakError({
					module,
					chunkGraph,
					request,
					type: "promise"
				});
			}
			throw new Error(
				`RuntimeTemplate.moduleNamespacePromise(): ${noModuleIdErrorMessage(
					module,
					chunkGraph
				)}`
			);
		}
		const promise = this.blockPromise({
			chunkGraph,
			block,
			message,
			runtimeRequirements
		});

		let appending;
		let idExpr = JSON.stringify(chunkGraph.getModuleId(module));
		const comment = this.comment({
			request
		});
		let header = "";
		if (weak) {
			if (idExpr.length > 8) {
				// 'var x="nnnnnn";x,"+x+",x' vs '"nnnnnn",nnnnnn,"nnnnnn"'
				header += `var id = ${idExpr}; `;
				idExpr = "id";
			}
			runtimeRequirements.add(RuntimeGlobals.moduleFactories);
			header += `if(!${
				RuntimeGlobals.moduleFactories
			}[${idExpr}]) { ${this.weakError({
				module,
				chunkGraph,
				request,
				idExpr,
				type: "statements"
			})} } `;
		}
		const moduleIdExpr = this.moduleId({
			module,
			chunkGraph,
			request,
			weak
		});
		const exportsType = module.getExportsType(chunkGraph.moduleGraph, strict);
		let fakeType = 16;
		switch (exportsType) {
			case "namespace":
				if (header) {
					const rawModule = this.moduleRaw({
						module,
						chunkGraph,
						request,
						weak,
						runtimeRequirements
					});
					appending = `.then(${this.basicFunction(
						"",
						`${header}return ${rawModule};`
					)})`;
				} else {
					runtimeRequirements.add(RuntimeGlobals.require);
					appending = `.then(__webpack_require__.bind(__webpack_require__, ${comment}${idExpr}))`;
				}
				break;
			case "dynamic":
				fakeType |= 4;
			/* fall through */
			case "default-with-named":
				fakeType |= 2;
			/* fall through */
			case "default-only":
				runtimeRequirements.add(RuntimeGlobals.createFakeNamespaceObject);
				if (chunkGraph.moduleGraph.isAsync(module)) {
					if (header) {
						const rawModule = this.moduleRaw({
							module,
							chunkGraph,
							request,
							weak,
							runtimeRequirements
						});
						appending = `.then(${this.basicFunction(
							"",
							`${header}return ${rawModule};`
						)})`;
					} else {
						runtimeRequirements.add(RuntimeGlobals.require);
						appending = `.then(__webpack_require__.bind(__webpack_require__, ${comment}${idExpr}))`;
					}
					appending += `.then(${this.returningFunction(
						`${RuntimeGlobals.createFakeNamespaceObject}(m, ${fakeType})`,
						"m"
					)})`;
				} else {
					fakeType |= 1;
					if (header) {
						const returnExpression = `${RuntimeGlobals.createFakeNamespaceObject}(${moduleIdExpr}, ${fakeType})`;
						appending = `.then(${this.basicFunction(
							"",
							`${header}return ${returnExpression};`
						)})`;
					} else {
						appending = `.then(${RuntimeGlobals.createFakeNamespaceObject}.bind(__webpack_require__, ${comment}${idExpr}, ${fakeType}))`;
					}
				}
				break;
		}

		return `${promise || "Promise.resolve()"}${appending}`;
	}

	// TODO:
	// 
	runtimeConditionExpression({
		chunkGraph,
		runtimeCondition,
		runtime,
		runtimeRequirements
	}) {
		if (runtimeCondition === undefined) return "true";
		if (typeof runtimeCondition === "boolean") return `${runtimeCondition}`;
		/** @type {Set<string>} */
		const positiveRuntimeIds = new Set();
		forEachRuntime(runtimeCondition, runtime =>
			positiveRuntimeIds.add(`${chunkGraph.getRuntimeId(runtime)}`)
		);
		/** @type {Set<string>} */
		const negativeRuntimeIds = new Set();
		forEachRuntime(subtractRuntime(runtime, runtimeCondition), runtime =>
			negativeRuntimeIds.add(`${chunkGraph.getRuntimeId(runtime)}`)
		);
		runtimeRequirements.add(RuntimeGlobals.runtimeId);
		return compileBooleanMatcher.fromLists(
			Array.from(positiveRuntimeIds),
			Array.from(negativeRuntimeIds)
		)(RuntimeGlobals.runtimeId);
	}

	// 返回 处理后的import语句
	// 示例:
	// var _utils_math__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/math */ "./src/utils/math.js");
	importStatement({
		update,
		module,
		chunkGraph,
		request,
		importVar,
		originModule,
		weak,
		runtimeRequirements
	}) {
		if (!module) {
			return [
				this.missingModuleStatement({
					request
				}),
				""
			];
		}
		if (chunkGraph.getModuleId(module) === null) {
			if (weak) {
				// only weak referenced modules don't get an id
				// we can always emit an error emitting code here
				return [
					this.weakError({
						module,
						chunkGraph,
						request,
						type: "statements"
					}),
					""
				];
			}
			throw new Error(
				`RuntimeTemplate.importStatement(): ${noModuleIdErrorMessage(
					module,
					chunkGraph
				)}`
			);
		}
		const moduleId = this.moduleId({
			module,
			chunkGraph,
			request,
			weak
		});
		const optDeclaration = update ? "" : "var ";

		const exportsType = module.getExportsType(
			chunkGraph.moduleGraph,
			originModule.buildMeta.strictHarmonyModule
		);
		runtimeRequirements.add(RuntimeGlobals.require);
		const importContent = `/* harmony import */ ${optDeclaration}${importVar} = __webpack_require__(${moduleId});\n`;

		if (exportsType === "dynamic") {
			runtimeRequirements.add(RuntimeGlobals.compatGetDefaultExport);
			return [
				importContent,
				`/* harmony import */ ${optDeclaration}${importVar}_default = /*#__PURE__*/${RuntimeGlobals.compatGetDefaultExport}(${importVar});\n`
			];
		}
		return [importContent, ""];
	}

	// TODO:
	//
	exportFromImport({
		moduleGraph,
		module,
		request,
		exportName,
		originModule,
		asiSafe,
		isCall,
		callContext,
		defaultInterop,
		importVar,
		initFragments,
		runtime,
		runtimeRequirements
	}) {
		if (!module) {
			return this.missingModule({
				request
			});
		}
		if (!Array.isArray(exportName)) {
			exportName = exportName ? [exportName] : [];
		}
		const exportsType = module.getExportsType(
			moduleGraph,
			originModule.buildMeta.strictHarmonyModule
		);

		if (defaultInterop) {
			if (exportName.length > 0 && exportName[0] === "default") {
				switch (exportsType) {
					case "dynamic":
						if (isCall) {
							return `${importVar}_default()${propertyAccess(exportName, 1)}`;
						} else {
							return asiSafe
								? `(${importVar}_default()${propertyAccess(exportName, 1)})`
								: asiSafe === false
								? `;(${importVar}_default()${propertyAccess(exportName, 1)})`
								: `${importVar}_default.a${propertyAccess(exportName, 1)}`;
						}
					case "default-only":
					case "default-with-named":
						exportName = exportName.slice(1);
						break;
				}
			} else if (exportName.length > 0) {
				if (exportsType === "default-only") {
					return (
						"/* non-default import from non-esm module */undefined" +
						propertyAccess(exportName, 1)
					);
				} else if (
					exportsType !== "namespace" &&
					exportName[0] === "__esModule"
				) {
					return "/* __esModule */true";
				}
			} else if (
				exportsType === "default-only" ||
				exportsType === "default-with-named"
			) {
				runtimeRequirements.add(RuntimeGlobals.createFakeNamespaceObject);
				initFragments.push(
					new InitFragment(
						`var ${importVar}_namespace_cache;\n`,
						InitFragment.STAGE_CONSTANTS,
						-1,
						`${importVar}_namespace_cache`
					)
				);
				return `/*#__PURE__*/ ${
					asiSafe ? "" : asiSafe === false ? ";" : "Object"
				}(${importVar}_namespace_cache || (${importVar}_namespace_cache = ${
					RuntimeGlobals.createFakeNamespaceObject
				}(${importVar}${exportsType === "default-only" ? "" : ", 2"})))`;
			}
		}

		if (exportName.length > 0) {
			const exportsInfo = moduleGraph.getExportsInfo(module);
			const used = exportsInfo.getUsedName(exportName, runtime);
			if (!used) {
				const comment = Template.toNormalComment(
					`unused export ${propertyAccess(exportName)}`
				);
				return `${comment} undefined`;
			}
			const comment = equals(used, exportName)
				? ""
				: Template.toNormalComment(propertyAccess(exportName)) + " ";
			const access = `${importVar}${comment}${propertyAccess(used)}`;
			if (isCall && callContext === false) {
				return asiSafe
					? `(0,${access})`
					: asiSafe === false
					? `;(0,${access})`
					: `Object(${access})`;
			}
			return access;
		} else {
			return importVar;
		}
	}

	// TODO:
	// 
	blockPromise({ block, message, chunkGraph, runtimeRequirements }) {
		if (!block) {
			const comment = this.comment({
				message
			});
			return `Promise.resolve(${comment.trim()})`;
		}
		const chunkGroup = chunkGraph.getBlockChunkGroup(block);
		if (!chunkGroup || chunkGroup.chunks.length === 0) {
			const comment = this.comment({
				message
			});
			return `Promise.resolve(${comment.trim()})`;
		}
		const chunks = chunkGroup.chunks.filter(
			chunk => !chunk.hasRuntime() && chunk.id !== null
		);
		const comment = this.comment({
			message,
			chunkName: block.chunkName
		});
		if (chunks.length === 1) {
			const chunkId = JSON.stringify(chunks[0].id);
			runtimeRequirements.add(RuntimeGlobals.ensureChunk);
			return `${RuntimeGlobals.ensureChunk}(${comment}${chunkId})`;
		} else if (chunks.length > 0) {
			runtimeRequirements.add(RuntimeGlobals.ensureChunk);
			const requireChunkId = chunk =>
				`${RuntimeGlobals.ensureChunk}(${JSON.stringify(chunk.id)})`;
			return `Promise.all(${comment.trim()}[${chunks
				.map(requireChunkId)
				.join(", ")}])`;
		} else {
			return `Promise.resolve(${comment.trim()})`;
		}
	}

	// TODO:
	// 异步模块工厂
	asyncModuleFactory({ block, chunkGraph, runtimeRequirements, request }) {
		const dep = block.dependencies[0];
		const module = chunkGraph.moduleGraph.getModule(dep);
		const ensureChunk = this.blockPromise({
			block,
			message: "",
			chunkGraph,
			runtimeRequirements
		});
		const factory = this.returningFunction(
			this.moduleRaw({
				module,
				chunkGraph,
				request,
				runtimeRequirements
			})
		);
		return this.returningFunction(
			ensureChunk.startsWith("Promise.resolve(")
				? `${factory}`
				: `${ensureChunk}.then(${this.returningFunction(factory)})`
		);
	}

	// TODO:
	// 同步模块工厂
	syncModuleFactory({ dependency, chunkGraph, runtimeRequirements, request }) {
		const module = chunkGraph.moduleGraph.getModule(dependency);
		const factory = this.returningFunction(
			this.moduleRaw({
				module,
				chunkGraph,
				request,
				runtimeRequirements
			})
		);
		return this.returningFunction(factory);
	}

	// TODO:
	// 定义 ES模块标记语句
	defineEsModuleFlagStatement({ exportsArgument, runtimeRequirements }) {
		runtimeRequirements.add(RuntimeGlobals.makeNamespaceObject);
		runtimeRequirements.add(RuntimeGlobals.exports);
		return `${RuntimeGlobals.makeNamespaceObject}(${exportsArgument});\n`;
	}
}

module.exports = RuntimeTemplate;
