"use strict";

const ModuleFilenameHelpers = require("./ModuleFilenameHelpers");
const NormalModule = require("./NormalModule");
const createSchemaValidation = require("./util/create-schema-validation");

// 验证 LoaderOptionsPlugin.options 
const validate = createSchemaValidation(
	require("../schemas/plugins/LoaderOptionsPlugin.check.js"),
	() => require("../schemas/plugins/LoaderOptionsPlugin.json"),
	{
		name: "Loader Options Plugin",
		baseDataPath: "options"
	}
);

// 有的 loader 需要从配置中读取一些 context 信息(保持对旧 loaders 的兼容)
// 目前版本的loader 从 loader.options 传入
class LoaderOptionsPlugin {
	constructor(options = {}) {
		validate(options);
		if (typeof options !== "object") options = {};
		if (!options.test) {
			options.test = {
				test: () => true
			};
		}
		this.options = options;
	}

	apply(compiler) {
		const options = this.options;
		compiler.hooks.compilation.tap("LoaderOptionsPlugin", compilation => {
			NormalModule.getCompilationHooks(compilation).loader.tap(
				"LoaderOptionsPlugin",
				(context, module) => {
					const resource = module.resource;
					if (!resource) return;
					const i = resource.indexOf("?");
					if (
						ModuleFilenameHelpers.matchObject(
							options,
							i < 0 ? resource : resource.substr(0, i)
						)
					) {
						for (const key of Object.keys(options)) {
							if (key === "include" || key === "exclude" || key === "test") {
								continue;
							}
							context[key] = options[key];
						}
					}
				}
			);
		});
	}
}

module.exports = LoaderOptionsPlugin;
