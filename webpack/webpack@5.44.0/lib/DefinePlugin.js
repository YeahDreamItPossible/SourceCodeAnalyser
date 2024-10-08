"use strict";

const RuntimeGlobals = require("./RuntimeGlobals");
const WebpackError = require("./WebpackError");
const ConstDependency = require("./dependencies/ConstDependency");
const BasicEvaluatedExpression = require("./javascript/BasicEvaluatedExpression");
const {
	evaluateToString,
	toConstantDependency
} = require("./javascript/JavascriptParserHelpers");
const { provide } = require("./util/MapHelpers");

// 运行时值
class RuntimeValue {
	constructor(fn, options) {
		this.fn = fn;
		// True || Array<String>
		if (Array.isArray(options)) {
			options = {
				fileDependencies: options
			};
		}
		this.options = options || {};
	}

	get fileDependencies() {
		return this.options === true ? true : this.options.fileDependencies;
	}

	/**
	 * @param {JavascriptParser} parser the parser
	 * @param {Map<string, string | Set<string>>} valueCacheVersions valueCacheVersions
	 * @param {string} key the defined key
	 * @returns {CodeValuePrimitive} code
	 */
	exec(parser, valueCacheVersions, key) {
		const buildInfo = parser.state.module.buildInfo;
		if (this.options === true) {
			buildInfo.cacheable = false;
		} else {
			if (this.options.fileDependencies) {
				for (const dep of this.options.fileDependencies) {
					buildInfo.fileDependencies.add(dep);
				}
			}
			if (this.options.contextDependencies) {
				for (const dep of this.options.contextDependencies) {
					buildInfo.contextDependencies.add(dep);
				}
			}
			if (this.options.missingDependencies) {
				for (const dep of this.options.missingDependencies) {
					buildInfo.missingDependencies.add(dep);
				}
			}
			if (this.options.buildDependencies) {
				for (const dep of this.options.buildDependencies) {
					buildInfo.buildDependencies.add(dep);
				}
			}
		}

		return this.fn({
			module: parser.state.module,
			key,
			get version() {
				return /** @type {string} */ (
					valueCacheVersions.get(VALUE_DEP_PREFIX + key)
				);
			}
		});
	}

	getCacheVersion() {
		return this.options === true
			? undefined
			: (typeof this.options.version === "function"
					? this.options.version()
					: this.options.version) || "unset";
	}
}

/**
 * @param {any[]|{[k: string]: any}} obj obj
 * @param {JavascriptParser} parser Parser
 * @param {Map<string, string | Set<string>>} valueCacheVersions valueCacheVersions
 * @param {string} key the defined key
 * @param {RuntimeTemplate} runtimeTemplate the runtime template
 * @param {boolean|undefined|null=} asiSafe asi safe (undefined: unknown, null: unneeded)
 * @returns {string} code converted to string that evaluates
 */
// 序列化
const stringifyObj = (
	obj,
	parser,
	valueCacheVersions,
	key,
	runtimeTemplate,
	asiSafe
) => {
	let code;
	let arr = Array.isArray(obj);
	if (arr) {
		code = `[${obj
			.map(code =>
				toCode(code, parser, valueCacheVersions, key, runtimeTemplate, null)
			)
			.join(",")}]`;
	} else {
		code = `{${Object.keys(obj)
			.map(key => {
				const code = obj[key];
				return (
					JSON.stringify(key) +
					":" +
					toCode(code, parser, valueCacheVersions, key, runtimeTemplate, null)
				);
			})
			.join(",")}}`;
	}

	switch (asiSafe) {
		case null:
			return code;
		case true:
			return arr ? code : `(${code})`;
		case false:
			return arr ? `;${code}` : `;(${code})`;
		default:
			return `Object(${code})`;
	}
};

/**
 * Convert code to a string that evaluates
 * @param {CodeValue} code Code to evaluate
 * @param {JavascriptParser} parser Parser
 * @param {Map<string, string | Set<string>>} valueCacheVersions valueCacheVersions
 * @param {string} key the defined key
 * @param {RuntimeTemplate} runtimeTemplate the runtime template
 * @param {boolean|undefined|null=} asiSafe asi safe (undefined: unknown, null: unneeded)
 * @returns {string} code converted to string that evaluates
 */
// 将 代码 转换成 可计算结果的字符串
const toCode = (
	code,
	parser,
	valueCacheVersions,
	key,
	runtimeTemplate,
	asiSafe
) => {
	if (code === null) {
		return "null";
	}
	if (code === undefined) {
		return "undefined";
	}
	if (Object.is(code, -0)) {
		return "-0";
	}
	if (code instanceof RuntimeValue) {
		return toCode(
			code.exec(parser, valueCacheVersions, key),
			parser,
			valueCacheVersions,
			key,
			runtimeTemplate,
			asiSafe
		);
	}
	if (code instanceof RegExp && code.toString) {
		return code.toString();
	}
	if (typeof code === "function" && code.toString) {
		return "(" + code.toString() + ")";
	}
	if (typeof code === "object") {
		return stringifyObj(
			code,
			parser,
			valueCacheVersions,
			key,
			runtimeTemplate,
			asiSafe
		);
	}
	if (typeof code === "bigint") {
		return runtimeTemplate.supportsBigIntLiteral()
			? `${code}n`
			: `BigInt("${code}")`;
	}
	return code + "";
};

// 在不依赖运行环境前提下 将 代码 转换成 字符串
const toCacheVersion = code => {
	if (code === null) {
		return "null";
	}
	if (code === undefined) {
		return "undefined";
	}
	if (Object.is(code, -0)) {
		return "-0";
	}
	if (code instanceof RuntimeValue) {
		return code.getCacheVersion();
	}
	if (code instanceof RegExp && code.toString) {
		return code.toString();
	}
	if (typeof code === "function" && code.toString) {
		return "(" + code.toString() + ")";
	}
	if (typeof code === "object") {
		const items = Object.keys(code).map(key => ({
			key,
			value: toCacheVersion(code[key])
		}));
		if (items.some(({ value }) => value === undefined)) return undefined;
		return `{${items.map(({ key, value }) => `${key}: ${value}`).join(", ")}}`;
	}
	if (typeof code === "bigint") {
		return `${code}n`;
	}
	return code + "";
};

// 命名空间
// 值依赖前缀
const VALUE_DEP_PREFIX = "webpack/DefinePlugin ";
// 值依赖主键
const VALUE_DEP_MAIN = "webpack/DefinePlugin";

// 定义插件
// 作用: 
// 允许在 编译时 将你代码中的变 量 替换为 其他值或表达式
// 原理: 
// 在 compiler.hooks.normalModuleFactory 钩子
class DefinePlugin {
	constructor(definitions) {
		// Record<String, CodeValue>
		this.definitions = definitions;
	}

	// 返回 RuntimeValue 实例
	static runtimeValue(fn, options) {
		return new RuntimeValue(fn, options);
	}

	apply(compiler) {
		const definitions = this.definitions;
		compiler.hooks.compilation.tap(
			"DefinePlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyTemplates.set(
					ConstDependency,
					new ConstDependency.Template()
				);
				const { runtimeTemplate } = compilation;

				// Set<String>
				const mainValue = (
					provide(
						compilation.valueCacheVersions,
						VALUE_DEP_MAIN,
						() => new Set()
					)
				);

				const handler = parser => {
					// 设置 module.buildInfo.valueDependencies
					parser.hooks.program.tap("DefinePlugin", () => {
						const { buildInfo } = parser.state.module;
						if (!buildInfo.valueDependencies) {
							buildInfo.valueDependencies = new Map();
						}
						buildInfo.valueDependencies.set(VALUE_DEP_MAIN, mainValue);
					});

					// 设置 module.buildInfo.valueDependencies
					const addValueDependency = key => {
						const { buildInfo } = parser.state.module;
						buildInfo.valueDependencies.set(
							VALUE_DEP_PREFIX + key,
							compilation.valueCacheVersions.get(VALUE_DEP_PREFIX + key)
						);
					};

					const withValueDependency =
						(key, fn) =>
						(...args) => {
							addValueDependency(key);
							return fn(...args);
						};

					// 遍历 定义项
					const walkDefinitions = (definitions, prefix) => {
						Object.keys(definitions).forEach(key => {
							const code = definitions[key];
							if (
								code &&
								typeof code === "object" &&
								!(code instanceof RuntimeValue) &&
								!(code instanceof RegExp)
							) {
								walkDefinitions(code, prefix + key + ".");
								applyObjectDefine(prefix + key, code);
								return;
							}
							applyDefineKey(prefix, key);
							applyDefine(prefix + key, code);
						});
					};

					// 针对 键值对 中键是 以 . 链接的标识符时
					// 示例: process.env.NODE_ENV
					const applyDefineKey = (prefix, key) => {
						const splittedKey = key.split(".");
						splittedKey.slice(1).forEach((_, i) => {
							const fullKey = prefix + splittedKey.slice(0, i + 1).join(".");
							parser.hooks.canRename.for(fullKey).tap("DefinePlugin", () => {
								addValueDependency(key);
								return true;
							});
						});
					};

					/**
					 * Apply Code
					 * @param {string} key Key
					 * @param {CodeValue} code Code
					 * @returns {void}
					 */
					const applyDefine = (key, code) => {
						const originalKey = key;
						const isTypeof = /^typeof\s+/.test(key);
						if (isTypeof) key = key.replace(/^typeof\s+/, "");
						let recurse = false;
						let recurseTypeof = false;
						if (!isTypeof) {
							// 
							parser.hooks.canRename.for(key).tap("DefinePlugin", () => {
								addValueDependency(originalKey);
								return true;
							});
							// 
							parser.hooks.evaluateIdentifier
								.for(key)
								.tap("DefinePlugin", expr => {
									/**
									 * this is needed in case there is a recursion in the DefinePlugin
									 * to prevent an endless recursion
									 * e.g.: new DefinePlugin({
									 * "a": "b",
									 * "b": "a"
									 * });
									 */
									if (recurse) return;
									addValueDependency(originalKey);
									recurse = true;
									const res = parser.evaluate(
										toCode(
											code,
											parser,
											compilation.valueCacheVersions,
											key,
											runtimeTemplate,
											null
										)
									);
									recurse = false;
									res.setRange(expr.range);
									return res;
								});
							// 核心
							// 当检测到表达式中含有 Key 时 返回 ConstDependency 示例
							parser.hooks.expression.for(key).tap("DefinePlugin", expr => {
								addValueDependency(originalKey);
								const strCode = toCode(
									code,
									parser,
									compilation.valueCacheVersions,
									originalKey,
									runtimeTemplate,
									!parser.isAsiPosition(expr.range[0])
								);
								// 返回 ConstDependency 实例 并将该 实例 村粗到 parser.state.module.addPresentationalDependency 中
								if (/__webpack_require__\s*(!?\.)/.test(strCode)) {
									return toConstantDependency(parser, strCode, [
										RuntimeGlobals.require
									])(expr);
								} else if (/__webpack_require__/.test(strCode)) {
									return toConstantDependency(parser, strCode, [
										RuntimeGlobals.requireScope
									])(expr);
								} else {
									return toConstantDependency(parser, strCode)(expr);
								}
							});
						}
						parser.hooks.evaluateTypeof.for(key).tap("DefinePlugin", expr => {
							/**
							 * this is needed in case there is a recursion in the DefinePlugin
							 * to prevent an endless recursion
							 * e.g.: new DefinePlugin({
							 * "typeof a": "typeof b",
							 * "typeof b": "typeof a"
							 * });
							 */
							if (recurseTypeof) return;
							recurseTypeof = true;
							addValueDependency(originalKey);
							const codeCode = toCode(
								code,
								parser,
								compilation.valueCacheVersions,
								originalKey,
								runtimeTemplate,
								null
							);
							const typeofCode = isTypeof
								? codeCode
								: "typeof (" + codeCode + ")";
							const res = parser.evaluate(typeofCode);
							recurseTypeof = false;
							res.setRange(expr.range);
							return res;
						});
						parser.hooks.typeof.for(key).tap("DefinePlugin", expr => {
							addValueDependency(originalKey);
							const codeCode = toCode(
								code,
								parser,
								compilation.valueCacheVersions,
								originalKey,
								runtimeTemplate,
								null
							);
							const typeofCode = isTypeof
								? codeCode
								: "typeof (" + codeCode + ")";
							const res = parser.evaluate(typeofCode);
							if (!res.isString()) return;
							return toConstantDependency(
								parser,
								JSON.stringify(res.string)
							).bind(parser)(expr);
						});
					};

					/**
					 * Apply Object
					 * @param {string} key Key
					 * @param {Object} obj Object
					 * @returns {void}
					 */
					const applyObjectDefine = (key, obj) => {
						parser.hooks.canRename.for(key).tap("DefinePlugin", () => {
							addValueDependency(key);
							return true;
						});
						parser.hooks.evaluateIdentifier
							.for(key)
							.tap("DefinePlugin", expr => {
								addValueDependency(key);
								return new BasicEvaluatedExpression()
									.setTruthy()
									.setSideEffects(false)
									.setRange(expr.range);
							});
						parser.hooks.evaluateTypeof
							.for(key)
							.tap(
								"DefinePlugin",
								withValueDependency(key, evaluateToString("object"))
							);
						parser.hooks.expression.for(key).tap("DefinePlugin", expr => {
							addValueDependency(key);
							const strCode = stringifyObj(
								obj,
								parser,
								compilation.valueCacheVersions,
								key,
								runtimeTemplate,
								!parser.isAsiPosition(expr.range[0])
							);

							if (/__webpack_require__\s*(!?\.)/.test(strCode)) {
								return toConstantDependency(parser, strCode, [
									RuntimeGlobals.require
								])(expr);
							} else if (/__webpack_require__/.test(strCode)) {
								return toConstantDependency(parser, strCode, [
									RuntimeGlobals.requireScope
								])(expr);
							} else {
								return toConstantDependency(parser, strCode)(expr);
							}
						});
						parser.hooks.typeof
							.for(key)
							.tap(
								"DefinePlugin",
								withValueDependency(
									key,
									toConstantDependency(parser, JSON.stringify("object"))
								)
							);
					};

					walkDefinitions(definitions, "");
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("DefinePlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("DefinePlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/esm")
					.tap("DefinePlugin", handler);

				// 将 定义的键值对 缓存到 compilation.valueCacheVersions 中
				const walkDefinitionsForValues = (definitions, prefix) => {
					Object.keys(definitions).forEach(key => {
						const code = definitions[key];
						const version = toCacheVersion(code);
						const name = VALUE_DEP_PREFIX + prefix + key;
						mainValue.add(name);
						const oldVersion = compilation.valueCacheVersions.get(name);
						if (oldVersion === undefined) {
							compilation.valueCacheVersions.set(name, version);
						} else if (oldVersion !== version) {
							const warning = new WebpackError(
								`DefinePlugin\nConflicting values for '${prefix + key}'`
							);
							warning.details = `'${oldVersion}' !== '${version}'`;
							warning.hideStack = true;
							compilation.warnings.push(warning);
						}
						if (
							code &&
							typeof code === "object" &&
							!(code instanceof RuntimeValue) &&
							!(code instanceof RegExp)
						) {
							walkDefinitionsForValues(code, prefix + key + ".");
						}
					});
				};

				walkDefinitionsForValues(definitions, "");
			}
		);
	}
}
module.exports = DefinePlugin;
