"use strict";

const createSchemaValidation = require("../util/create-schema-validation");
const JsonGenerator = require("./JsonGenerator");
const JsonParser = require("./JsonParser");

// 验证选项
const validate = createSchemaValidation(
	require("../../schemas/plugins/JsonModulesPluginParser.check.js"),
	() => require("../../schemas/plugins/JsonModulesPluginParser.json"),
	{
		name: "Json Modules Plugin",
		baseDataPath: "parser"
	}
);

// 给 compiler.hooks.compilation 注册事件
// 给 normalModuleFactory.hooks.createParser 注册事件
// 给 normalMOduleFactory.hooks.createGenerator 注册事件
class JsonModulesPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"JsonModulesPlugin",
			(compilation, { normalModuleFactory }) => {
				normalModuleFactory.hooks.createParser
					.for("json")
					.tap("JsonModulesPlugin", parserOptions => {
						validate(parserOptions);

						return new JsonParser(parserOptions);
					});
				normalModuleFactory.hooks.createGenerator
					.for("json")
					.tap("JsonModulesPlugin", () => {
						return new JsonGenerator();
					});
			}
		);
	}
}

module.exports = JsonModulesPlugin;
