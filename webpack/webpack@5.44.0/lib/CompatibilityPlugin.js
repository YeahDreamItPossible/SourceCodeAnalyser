"use strict";

const ConstDependency = require("./dependencies/ConstDependency");

const nestedWebpackRequireTag = Symbol("nested __webpack_require__");

// 兼容性插件
// 作用:
// 
class CompatibilityPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"CompatibilityPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyTemplates.set(
					ConstDependency,
					new ConstDependency.Template()
				);

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("CompatibilityPlugin", (parser, parserOptions) => {
						if (
							parserOptions.browserify !== undefined &&
							!parserOptions.browserify
						)
							return;

						parser.hooks.call
							.for("require")
							.tap("CompatibilityPlugin", expr => {
								// support for browserify style require delegator: "require(o, !0)"
								if (expr.arguments.length !== 2) return;
								const second = parser.evaluateExpression(expr.arguments[1]);
								if (!second.isBoolean()) return;
								if (second.asBool() !== true) return;
								const dep = new ConstDependency("require", expr.callee.range);
								dep.loc = expr.loc;
								if (parser.state.current.dependencies.length > 0) {
									const last =
										parser.state.current.dependencies[
											parser.state.current.dependencies.length - 1
										];
									if (
										last.critical &&
										last.options &&
										last.options.request === "." &&
										last.userRequest === "." &&
										last.options.recursive
									)
										parser.state.current.dependencies.pop();
								}
								parser.state.module.addPresentationalDependency(dep);
								return true;
							});
					});

				/**
				 * @param {JavascriptParser} parser the parser
				 * @returns {void}
				 */
				const nestedWebpackRequireHandler = parser => {
					parser.hooks.preStatement.tap("CompatibilityPlugin", statement => {
						if (
							statement.type === "FunctionDeclaration" &&
							statement.id &&
							statement.id.name === "__webpack_require__"
						) {
							const newName = `__nested_webpack_require_${statement.range[0]}__`;
							parser.tagVariable(statement.id.name, nestedWebpackRequireTag, {
								name: newName,
								declaration: {
									updated: false,
									loc: statement.id.loc,
									range: statement.id.range
								}
							});
							return true;
						}
					});
					parser.hooks.pattern
						.for("__webpack_require__")
						.tap("CompatibilityPlugin", pattern => {
							const newName = `__nested_webpack_require_${pattern.range[0]}__`;
							parser.tagVariable(pattern.name, nestedWebpackRequireTag, {
								name: newName,
								declaration: {
									updated: false,
									loc: pattern.loc,
									range: pattern.range
								}
							});
							return true;
						});
					parser.hooks.expression
						.for(nestedWebpackRequireTag)
						.tap("CompatibilityPlugin", expr => {
							const { name, declaration } = parser.currentTagData;
							if (!declaration.updated) {
								const dep = new ConstDependency(name, declaration.range);
								dep.loc = declaration.loc;
								parser.state.module.addPresentationalDependency(dep);
								declaration.updated = true;
							}
							const dep = new ConstDependency(name, expr.range);
							dep.loc = expr.loc;
							parser.state.module.addPresentationalDependency(dep);
							return true;
						});
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("CompatibilityPlugin", nestedWebpackRequireHandler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("CompatibilityPlugin", nestedWebpackRequireHandler);
				normalModuleFactory.hooks.parser
					.for("javascript/esm")
					.tap("CompatibilityPlugin", nestedWebpackRequireHandler);
			}
		);
	}
}
module.exports = CompatibilityPlugin;
