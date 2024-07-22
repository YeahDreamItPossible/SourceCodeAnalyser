"use strict";

const isValidExternalsType = require("../../schemas/plugins/container/ExternalsType.check.js");
const SharePlugin = require("../sharing/SharePlugin");
const createSchemaValidation = require("../util/create-schema-validation");
const ContainerPlugin = require("./ContainerPlugin");
const ContainerReferencePlugin = require("./ContainerReferencePlugin");

// 验证 ModuleFederation options 是否合法
const validate = createSchemaValidation(
	require("../../schemas/plugins/container/ModuleFederationPlugin.check.js"),
	() => require("../../schemas/plugins/container/ModuleFederationPlugin.json"),
	{
		name: "Module Federation Plugin",
		baseDataPath: "options"
	}
);

// 模块联邦插件
// 作用:
// 1. 允许将 满足匹配要求的某些模块 编译成单独的应用 供其他应用加载使用
// 2. 允许从 远程应用 中加载远程模块 直接使用
class ModuleFederationPlugin {
	constructor(options) {
		validate(options);
		this._options = options;
	}

	apply(compiler) {
		const { _options: options } = this;
		const library = options.library || { type: "var", name: options.name };
		// 远程库类型
		const remoteType =
			options.remoteType ||
			(options.library && isValidExternalsType(options.library.type)
				? (options.library.type)
				: "script");
		if (
			library &&
			!compiler.options.output.enabledLibraryTypes.includes(library.type)
		) {
			compiler.options.output.enabledLibraryTypes.push(library.type);
		}
		compiler.hooks.afterPlugins.tap("ModuleFederationPlugin", () => {
			if (
				options.exposes &&
				(Array.isArray(options.exposes)
					? options.exposes.length > 0
					: Object.keys(options.exposes).length > 0)
			) {
				new ContainerPlugin({
					name: options.name,
					library,
					filename: options.filename,
					runtime: options.runtime,
					exposes: options.exposes
				}).apply(compiler);
			}
			if (
				options.remotes &&
				(Array.isArray(options.remotes)
					? options.remotes.length > 0
					: Object.keys(options.remotes).length > 0)
			) {
				new ContainerReferencePlugin({
					remoteType,
					remotes: options.remotes
				}).apply(compiler);
			}
			if (options.shared) {
				new SharePlugin({
					shared: options.shared,
					shareScope: options.shareScope
				}).apply(compiler);
			}
		});
	}
}

module.exports = ModuleFederationPlugin;
