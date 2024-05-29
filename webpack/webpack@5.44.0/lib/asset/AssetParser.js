"use strict";

const Parser = require("../Parser");

class AssetParser extends Parser {
	constructor(dataUrlCondition) {
		super();
		this.dataUrlCondition = dataUrlCondition;
	}

	parse(source, state) {
		if (typeof source === "object" && !Buffer.isBuffer(source)) {
			throw new Error("AssetParser doesn't accept preparsed AST");
		}
		state.module.buildInfo.strict = true;
		state.module.buildMeta.exportsType = "default";

		if (typeof this.dataUrlCondition === "function") {
			state.module.buildInfo.dataUrl = this.dataUrlCondition(source, {
				filename: state.module.matchResource || state.module.resource,
				module: state.module
			});
		} else if (typeof this.dataUrlCondition === "boolean") {
			state.module.buildInfo.dataUrl = this.dataUrlCondition;
		} else if (
			this.dataUrlCondition &&
			typeof this.dataUrlCondition === "object"
		) {
			state.module.buildInfo.dataUrl =
				Buffer.byteLength(source) <= this.dataUrlCondition.maxSize;
		} else {
			throw new Error("Unexpected dataUrlCondition type");
		}

		return state;
	}
}

module.exports = AssetParser;
