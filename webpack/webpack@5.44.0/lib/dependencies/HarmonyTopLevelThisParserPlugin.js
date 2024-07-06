"use strict";

const ConstDependency = require("./ConstDependency");
const HarmonyExports = require("./HarmonyExports");

// ES模块顶级This指向语法分析器插件
// 该依赖主要用来分析 this 作用域
class HarmonyTopLevelThisParserPlugin {
	apply(parser) {
		parser.hooks.expression
			.for("this")
			.tap("HarmonyTopLevelThisParserPlugin", node => {
				if (!parser.scope.topLevelScope) return;
				if (HarmonyExports.isEnabled(parser.state)) {
					// ES模块中 顶级this 指向 undefined
					const dep = new ConstDependency("undefined", node.range, null);
					dep.loc = node.loc;
					parser.state.module.addPresentationalDependency(dep);
					return this;
				}
			});
	}
}

module.exports = HarmonyTopLevelThisParserPlugin;
