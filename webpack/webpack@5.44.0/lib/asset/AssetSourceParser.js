"use strict";

const Parser = require("../Parser");

class AssetSourceParser extends Parser {
	parse(source, state) {
		if (typeof source === "object" && !Buffer.isBuffer(source)) {
			throw new Error("AssetSourceParser doesn't accept preparsed AST");
		}
		const { module } = state;
		module.buildInfo.strict = true;
		module.buildMeta.exportsType = "default";

		return state;
	}
}

module.exports = AssetSourceParser;
