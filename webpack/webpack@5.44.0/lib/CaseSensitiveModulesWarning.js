"use strict";

const WebpackError = require("./WebpackError");

// 模块排序
const sortModules = modules => {
	return modules.sort((a, b) => {
		const aIdent = a.identifier();
		const bIdent = b.identifier();
		/* istanbul ignore next */
		if (aIdent < bIdent) return -1;
		/* istanbul ignore next */
		if (aIdent > bIdent) return 1;
		/* istanbul ignore next */
		return 0;
	});
};

// 
const createModulesListMessage = (modules, moduleGraph) => {
	return modules
		.map(m => {
			let message = `* ${m.identifier()}`;
			const validReasons = Array.from(
				moduleGraph.getIncomingConnectionsByOriginModule(m).keys()
			).filter(x => x);

			if (validReasons.length > 0) {
				message += `\n    Used by ${validReasons.length} module(s), i. e.`;
				message += `\n    ${validReasons[0].identifier()}`;
			}
			return message;
		})
		.join("\n");
};

// 区分模块大小写警告
class CaseSensitiveModulesWarning extends WebpackError {
	constructor(modules, moduleGraph) {
		const sortedModules = sortModules(Array.from(modules));
		const modulesList = createModulesListMessage(sortedModules, moduleGraph);
		super(`There are multiple modules with names that only differ in casing.
This can lead to unexpected behavior when compiling on a filesystem with other case-semantic.
Use equal casing. Compare these module identifiers:
${modulesList}`);

		this.name = "CaseSensitiveModulesWarning";
		this.module = sortedModules[0];
	}
}

module.exports = CaseSensitiveModulesWarning;
