"use strict";

const parseJson = require("json-parse-better-errors");
const Parser = require("../Parser");
const JsonExportsDependency = require("../dependencies/JsonExportsDependency");
const JsonData = require("./JsonData");

// JSON类型 语法分析器
class JsonParser extends Parser {
	constructor(options) {
		super();
		this.options = options || {};
	}

	// 调用parse函数
	parse(source, state) {
		if (Buffer.isBuffer(source)) {
			source = source.toString("utf-8");
		}

		const parseFn =
			typeof this.options.parse === "function" ? this.options.parse : parseJson;

		const data =
			typeof source === "object"
				? source
				: parseFn(source[0] === "\ufeff" ? source.slice(1) : source);

		state.module.buildInfo.jsonData = new JsonData(data);
		state.module.buildInfo.strict = true;
		state.module.buildMeta.exportsType = "default";
		state.module.buildMeta.defaultObject =
			typeof data === "object" ? "redirect-warn" : false;
		state.module.addDependency(
			new JsonExportsDependency(JsonExportsDependency.getExportsFromData(data))
		);
		return state;
	}
}

module.exports = JsonParser;
