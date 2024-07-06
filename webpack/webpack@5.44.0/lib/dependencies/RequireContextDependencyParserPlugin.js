"use strict";

const RequireContextDependency = require("./RequireContextDependency");

// 主要是用来解析 webpack特有的 require.context 语法
module.exports = class RequireContextDependencyParserPlugin {
	apply(parser) {
		parser.hooks.call
			.for("require.context")
			.tap("RequireContextDependencyParserPlugin", expr => {
				let regExp = /^\.\/.*$/;
				let recursive = true;
				let mode = "sync";
				// 解析 require.context 参数
				switch (expr.arguments.length) {
					case 4: {
						const modeExpr = parser.evaluateExpression(expr.arguments[3]);
						if (!modeExpr.isString()) return;
						mode = modeExpr.string;
					}
					// falls through
					case 3: {
						const regExpExpr = parser.evaluateExpression(expr.arguments[2]);
						if (!regExpExpr.isRegExp()) return;
						regExp = regExpExpr.regExp;
					}
					// falls through
					case 2: {
						const recursiveExpr = parser.evaluateExpression(expr.arguments[1]);
						if (!recursiveExpr.isBoolean()) return;
						recursive = recursiveExpr.bool;
					}
					// falls through
					case 1: {
						const requestExpr = parser.evaluateExpression(expr.arguments[0]);
						if (!requestExpr.isString()) return;
						const dep = new RequireContextDependency(
							{
								request: requestExpr.string,
								recursive,
								regExp,
								mode,
								category: "commonjs"
							},
							expr.range
						);
						dep.loc = expr.loc;
						dep.optional = !!parser.scope.inTry;
						parser.state.current.addDependency(dep);
						return true;
					}
				}
			});
	}
};
