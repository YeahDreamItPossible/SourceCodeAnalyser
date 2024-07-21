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

// JSON模块插件
// 作用:
// 注册 JSON模块类型的 语法分析器 代码生成器
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
