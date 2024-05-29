"use strict";

const { approve } = require("../javascript/JavascriptParserHelpers");
const InnerGraph = require("../optimize/InnerGraph");
const URLDependency = require("./URLDependency");

class URLPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"URLPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(URLDependency, normalModuleFactory);
				compilation.dependencyTemplates.set(
					URLDependency,
					new URLDependency.Template()
				);

				const parserCallback = (parser, parserOptions) => {
					// 当 Webpack.Config.module.parser.['javascript/auto'].url = false 时
					// 当 Webpack.Config.module.parser.['javascript/esm'].url = false 时
					// 明确禁用 Url
					if (parserOptions.url === false) return;
					// 是否时相对路径
					const relative = parserOptions.url === "relative";

					/**
					 * @param {NewExpressionNode} expr expression
					 * @returns {undefined | string} request
					 */
					const getUrlRequest = expr => {
						if (expr.arguments.length !== 2) return;

						const [arg1, arg2] = expr.arguments;

						if (
							arg2.type !== "MemberExpression" ||
							arg1.type === "SpreadElement"
						)
							return;

						const chain = parser.extractMemberExpressionChain(arg2);

						if (
							chain.members.length !== 1 ||
							chain.object.type !== "MetaProperty" ||
							chain.object.meta.name !== "import" ||
							chain.object.property.name !== "meta" ||
							chain.members[0] !== "url"
						)
							return;

						const request = parser.evaluateExpression(arg1).asString();

						return request;
					};

					parser.hooks.canRename.for("URL").tap("URLPlugin", approve);
					parser.hooks.new.for("URL").tap("URLPlugin", _expr => {
						const expr = /** @type {NewExpressionNode} */ (_expr);

						const request = getUrlRequest(expr);

						if (!request) return;

						const [arg1, arg2] = expr.arguments;
						const dep = new URLDependency(
							request,
							[arg1.range[0], arg2.range[1]],
							expr.range,
							relative
						);
						dep.loc = expr.loc;
						parser.state.module.addDependency(dep);
						InnerGraph.onUsage(parser.state, e => (dep.usedByExports = e));
						return true;
					});
					parser.hooks.isPure.for("NewExpression").tap("URLPlugin", _expr => {
						const expr = /** @type {NewExpressionNode} */ (_expr);
						const { callee } = expr;
						if (callee.type !== "Identifier") return;
						const calleeInfo = parser.getFreeInfoFromVariable(callee.name);
						if (!calleeInfo || calleeInfo.name !== "URL") return;

						const request = getUrlRequest(expr);

						if (request) return true;
					});
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("URLPlugin", parserCallback);

				normalModuleFactory.hooks.parser
					.for("javascript/esm")
					.tap("URLPlugin", parserCallback);
			}
		);
	}
}

module.exports = URLPlugin;
