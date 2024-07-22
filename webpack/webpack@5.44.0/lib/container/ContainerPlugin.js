"use strict";

const createSchemaValidation = require("../util/create-schema-validation");
const ContainerEntryDependency = require("./ContainerEntryDependency");
const ContainerEntryModuleFactory = require("./ContainerEntryModuleFactory");
const ContainerExposedDependency = require("./ContainerExposedDependency");
const { parseOptions } = require("./options");

// 验证 ContainerPlugin options 是否合法
const validate = createSchemaValidation(
	require("../../schemas/plugins/container/ContainerPlugin.check.js"),
	() => require("../../schemas/plugins/container/ContainerPlugin.json"),
	{
		name: "Container Plugin",
		baseDataPath: "options"
	}
);

const PLUGIN_NAME = "ContainerPlugin";

// 容器插件
// 作用:
// 新增 容器入口 并将此次编译结果作为单独的容器 供其他容器使用
// 即: 新增编译入口 并将当前编译的结果 作为一个单独的应用 供别的应用使用
class ContainerPlugin {
	constructor(options) {
		validate(options);

		this._options = {
			name: options.name,
			shareScope: options.shareScope || "default",
			library: options.library || {
				type: "var",
				name: options.name
			},
			runtime: options.runtime,
			filename: options.filename || undefined,
			exposes: parseOptions(
				options.exposes,
				item => ({
					import: Array.isArray(item) ? item : [item],
					name: undefined
				}),
				item => ({
					import: Array.isArray(item.import) ? item.import : [item.import],
					name: item.name || undefined
				})
			)
		};
	}

	apply(compiler) {
		const { name, exposes, shareScope, filename, library, runtime } =
			this._options;

		compiler.options.output.enabledLibraryTypes.push(library.type);

		compiler.hooks.make.tapAsync(PLUGIN_NAME, (compilation, callback) => {
			const dep = new ContainerEntryDependency(name, exposes, shareScope);
			dep.loc = { name };
			compilation.addEntry(
				compilation.options.context,
				dep,
				{
					name,
					filename,
					runtime,
					library
				},
				error => {
					if (error) return callback(error);
					callback();
				}
			);
		});

		compiler.hooks.thisCompilation.tap(
			PLUGIN_NAME,
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					ContainerEntryDependency,
					new ContainerEntryModuleFactory()
				);

				compilation.dependencyFactories.set(
					ContainerExposedDependency,
					normalModuleFactory
				);
			}
		);
	}
}

module.exports = ContainerPlugin;
