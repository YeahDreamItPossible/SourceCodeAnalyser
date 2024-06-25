"use strict";

const DllEntryPlugin = require("./DllEntryPlugin");
const FlagAllModulesAsUsedPlugin = require("./FlagAllModulesAsUsedPlugin");
const LibManifestPlugin = require("./LibManifestPlugin");
const createSchemaValidation = require("./util/create-schema-validation");

// 验证 DllPlugin.options 选项
const validate = createSchemaValidation(
	require("../schemas/plugins/DllPlugin.check.js"),
	() => require("../schemas/plugins/DllPlugin.json"),
	{
		name: "Dll Plugin",
		baseDataPath: "options"
	}
);

// 动态链接库插件
// 用某种方法实现了拆分 bundles，同时还大幅度提升了构建的速度
// 此插件会生成一个名为 manifest.json 的文件
// 这个文件包含了从 require 和 import 中 request 到模块 id 的映射
class DllPlugin {
	constructor(options) {
		validate(options);
		this.options = {
			...options,
			entryOnly: options.entryOnly !== false
		};
	}

	apply(compiler) {
		compiler.hooks.entryOption.tap("DllPlugin", (context, entry) => {
			if (typeof entry !== "function") {
				for (const name of Object.keys(entry)) {
					const options = {
						name,
						filename: entry.filename
					};
					new DllEntryPlugin(context, entry[name].import, options).apply(
						compiler
					);
				}
			} else {
				throw new Error(
					"DllPlugin doesn't support dynamic entry (function) yet"
				);
			}
			return true;
		});
		new LibManifestPlugin(this.options).apply(compiler);
		if (!this.options.entryOnly) {
			new FlagAllModulesAsUsedPlugin("DllPlugin").apply(compiler);
		}
	}
}

module.exports = DllPlugin;
