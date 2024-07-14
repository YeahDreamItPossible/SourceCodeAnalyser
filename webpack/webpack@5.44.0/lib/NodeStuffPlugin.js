"use strict";

const RuntimeGlobals = require("./RuntimeGlobals");
const CachedConstDependency = require("./dependencies/CachedConstDependency");
const ConstDependency = require("./dependencies/ConstDependency");
const {
	evaluateToString,
	expressionIsUnsupported
} = require("./javascript/JavascriptParserHelpers");
const { relative } = require("./util/fs");
const { parseResource } = require("./util/identifier");

// Node填充插件
// 该插件主要是 polyfill(填充) 或 mock(模拟) 某些 Node.js 全局变量
class NodeStuffPlugin {
	constructor(options) {
		// Webpack.options.node
		this.options = options;
	}

	apply(compiler) {
		const options = this.options;
		compiler.hooks.compilation.tap(
			"NodeStuffPlugin",
			(compilation, { normalModuleFactory }) => {
				const handler = (parser, parserOptions) => {
					if (parserOptions.node === false) return;

					let localOptions = options;
					if (parserOptions.node) {
						// 将 NodeStuffPlugin.options 和 Webpack.options.node 合并
						localOptions = { ...localOptions, ...parserOptions.node };
					}

					// 兼容 node 环境下 global 变量
					if (localOptions.global) {
						parser.hooks.expression
							.for("global")
							.tap("NodeStuffPlugin", expr => {
								// 默认将 global 替换成 __webpack_require__.g
								const dep = new ConstDependency(
									RuntimeGlobals.global,
									expr.range,
									[RuntimeGlobals.global]
								);
								dep.loc = expr.loc;
								parser.state.module.addPresentationalDependency(dep);
							});
					}

					const setModuleConstant = (expressionName, fn) => {
						parser.hooks.expression
							.for(expressionName)
							.tap("NodeStuffPlugin", expr => {
								const dep = new CachedConstDependency(
									JSON.stringify(fn(parser.state.module)),
									expr.range,
									expressionName
								);
								dep.loc = expr.loc;
								parser.state.module.addPresentationalDependency(dep);
								return true;
							});
					};

					const setConstant = (expressionName, value) =>
						setModuleConstant(expressionName, () => value);

					const context = compiler.context;
					// 兼容 node 环境下 __filename 变量
					if (localOptions.__filename) {
						if (localOptions.__filename === "mock") {
							setConstant("__filename", "/index.js");
						} else if (localOptions.__filename === true) {
							setModuleConstant("__filename", module =>
								relative(compiler.inputFileSystem, context, module.resource)
							);
						}
						parser.hooks.evaluateIdentifier
							.for("__filename")
							.tap("NodeStuffPlugin", expr => {
								if (!parser.state.module) return;
								const resource = parseResource(parser.state.module.resource);
								return evaluateToString(resource.path)(expr);
							});
					}

					// 兼容 node 环境下 __dirname 变量
					if (localOptions.__dirname) {
						if (localOptions.__dirname === "mock") {
							setConstant("__dirname", "/");
						} else if (localOptions.__dirname === true) {
							setModuleConstant("__dirname", module =>
								relative(compiler.inputFileSystem, context, module.context)
							);
						}
						parser.hooks.evaluateIdentifier
							.for("__dirname")
							.tap("NodeStuffPlugin", expr => {
								if (!parser.state.module) return;
								return evaluateToString(parser.state.module.context)(expr);
							});
					}

					// 不再支持 requrie.extensions 
					parser.hooks.expression
						.for("require.extensions")
						.tap(
							"NodeStuffPlugin",
							expressionIsUnsupported(
								parser,
								"require.extensions is not supported by webpack. Use a loader instead."
							)
						);
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("NodeStuffPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("NodeStuffPlugin", handler);
			}
		);
	}
}

module.exports = NodeStuffPlugin;
