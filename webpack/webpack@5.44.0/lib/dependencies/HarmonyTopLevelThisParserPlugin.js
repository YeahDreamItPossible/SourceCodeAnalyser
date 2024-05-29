"use strict";

const ConstDependency = require("./ConstDependency");
const HarmonyExports = require("./HarmonyExports");

// TODO:
// ES模块 TopLevelThis 语法分析器 插件
class HarmonyTopLevelThisParserPlugin {
	apply(parser) {
		parser.hooks.expression
			.for("this")
			.tap("HarmonyTopLevelThisParserPlugin", node => {
				if (!parser.scope.topLevelScope) return;
				if (HarmonyExports.isEnabled(parser.state)) {
					const dep = new ConstDependency("undefined", node.range, null);
					dep.loc = node.loc;
					parser.state.module.addPresentationalDependency(dep);
					return this;
				}
			});
	}
}

module.exports = HarmonyTopLevelThisParserPlugin;
