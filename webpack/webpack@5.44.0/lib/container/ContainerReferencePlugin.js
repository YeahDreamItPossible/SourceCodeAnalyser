"use strict";

const ExternalsPlugin = require("../ExternalsPlugin");
const RuntimeGlobals = require("../RuntimeGlobals");
const createSchemaValidation = require("../util/create-schema-validation");
const FallbackDependency = require("./FallbackDependency");
const FallbackItemDependency = require("./FallbackItemDependency");
const FallbackModuleFactory = require("./FallbackModuleFactory");
const RemoteModule = require("./RemoteModule");
const RemoteRuntimeModule = require("./RemoteRuntimeModule");
const RemoteToExternalDependency = require("./RemoteToExternalDependency");
const { parseOptions } = require("./options");

/** @typedef {import("../../declarations/plugins/container/ContainerReferencePlugin").ContainerReferencePluginOptions} ContainerReferencePluginOptions */
/** @typedef {import("../../declarations/plugins/container/ContainerReferencePlugin").RemotesConfig} RemotesConfig */
/** @typedef {import("../Compiler")} Compiler */

const validate = createSchemaValidation(
	require("../../schemas/plugins/container/ContainerReferencePlugin.check.js"),
	() =>
		require("../../schemas/plugins/container/ContainerReferencePlugin.json"),
	{
		name: "Container Reference Plugin",
		baseDataPath: "options"
	}
);

const slashCode = "/".charCodeAt(0);

// 容器关联插件
// 作用:
// 在 模块联邦 中
class ContainerReferencePlugin {
	constructor(options) {
		validate(options);

		this._remoteType = options.remoteType;
		this._remotes = parseOptions(
			options.remotes,
			item => ({
				external: Array.isArray(item) ? item : [item],
				shareScope: options.shareScope || "default"
			}),
			item => ({
				external: Array.isArray(item.external)
					? item.external
					: [item.external],
				shareScope: item.shareScope || options.shareScope || "default"
			})
		);
	}

	apply(compiler) {
		const { _remotes: remotes, _remoteType: remoteType } = this;

		// Record<String, String>
		const remoteExternals = {};
		for (const [key, config] of remotes) {
			let i = 0;
			for (const external of config.external) {
				if (external.startsWith("internal ")) continue;
				remoteExternals[
					`webpack/container/reference/${key}${i ? `/fallback-${i}` : ""}`
				] = external;
				i++;
			}
		}

		new ExternalsPlugin(remoteType, remoteExternals).apply(compiler);

		compiler.hooks.compilation.tap(
			"ContainerReferencePlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					RemoteToExternalDependency,
					normalModuleFactory
				);

				compilation.dependencyFactories.set(
					FallbackItemDependency,
					normalModuleFactory
				);

				compilation.dependencyFactories.set(
					FallbackDependency,
					new FallbackModuleFactory()
				);

				normalModuleFactory.hooks.factorize.tap(
					"ContainerReferencePlugin",
					data => {
						if (!data.request.includes("!")) {
							for (const [key, config] of remotes) {
								if (
									data.request.startsWith(`${key}`) &&
									(data.request.length === key.length ||
										data.request.charCodeAt(key.length) === slashCode)
								) {
									return new RemoteModule(
										data.request,
										config.external.map((external, i) =>
											external.startsWith("internal ")
												? external.slice(9)
												: `webpack/container/reference/${key}${
														i ? `/fallback-${i}` : ""
												  }`
										),
										`.${data.request.slice(key.length)}`,
										config.shareScope
									);
								}
							}
						}
					}
				);

				compilation.hooks.runtimeRequirementInTree
					.for(RuntimeGlobals.ensureChunkHandlers)
					.tap("ContainerReferencePlugin", (chunk, set) => {
						set.add(RuntimeGlobals.module);
						set.add(RuntimeGlobals.moduleFactoriesAddOnly);
						set.add(RuntimeGlobals.hasOwnProperty);
						set.add(RuntimeGlobals.initializeSharing);
						set.add(RuntimeGlobals.shareScopeMap);
						compilation.addRuntimeModule(chunk, new RemoteRuntimeModule());
					});
			}
		);
	}
}

module.exports = ContainerReferencePlugin;
