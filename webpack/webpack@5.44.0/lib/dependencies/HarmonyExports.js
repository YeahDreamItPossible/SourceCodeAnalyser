"use strict";


// WeakMap<ParserState, boolean>
const parserStateExportsState = new WeakMap();

// 设置 parser.module.buildInfo
// 设置 parser.module.buildMeta
exports.enable = (parserState, isStrictHarmony) => {
	const value = parserStateExportsState.get(parserState);
	if (value === false) return;
	parserStateExportsState.set(parserState, true);
	if (value !== true) {
		parserState.module.buildMeta.exportsType = "namespace";
		parserState.module.buildInfo.strict = true;
		parserState.module.buildInfo.exportsArgument = "__webpack_exports__";
		// 当该模块是 ES 模块时
		if (isStrictHarmony) {
			parserState.module.buildMeta.strictHarmonyModule = true;
			parserState.module.buildInfo.moduleArgument = "__webpack_module__";
		}
	}
};

/**
 * @param {ParserState} parserState parser state
 * @returns {boolean} true, when enabled
 */
exports.isEnabled = parserState => {
	const value = parserStateExportsState.get(parserState);
	return value === true;
};
