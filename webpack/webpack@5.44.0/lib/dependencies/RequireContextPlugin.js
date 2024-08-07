"use strict";

const { cachedSetProperty } = require("../util/cleverMerge");
const ContextElementDependency = require("./ContextElementDependency");
const RequireContextDependency = require("./RequireContextDependency");
const RequireContextDependencyParserPlugin = require("./RequireContextDependencyParserPlugin");

// 
const EMPTY_RESOLVE_OPTIONS = {};

// 主要是用来解析 webpack特有的 require.context 语法
class RequireContextPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"RequireContextPlugin",
			(compilation, { contextModuleFactory, normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					RequireContextDependency,
					contextModuleFactory
				);
				compilation.dependencyTemplates.set(
					RequireContextDependency,
					new RequireContextDependency.Template()
				);

				compilation.dependencyFactories.set(
					ContextElementDependency,
					normalModuleFactory
				);

				const handler = (parser, parserOptions) => {
					if (
						parserOptions.requireContext !== undefined &&
						!parserOptions.requireContext
					)
						return;

					new RequireContextDependencyParserPlugin().apply(parser);
				};

				normalModuleFactory.hooks.parser
					.for("javascript/auto")
					.tap("RequireContextPlugin", handler);
				normalModuleFactory.hooks.parser
					.for("javascript/dynamic")
					.tap("RequireContextPlugin", handler);

				contextModuleFactory.hooks.alternativeRequests.tap(
					"RequireContextPlugin",
					(items, options) => {
						if (items.length === 0) return items;

						const finalResolveOptions = compiler.resolverFactory.get(
							"normal",
							cachedSetProperty(
								options.resolveOptions || EMPTY_RESOLVE_OPTIONS,
								"dependencyType",
								options.category
							)
						).options;

						let newItems;
						if (!finalResolveOptions.fullySpecified) {
							newItems = [];
							for (const item of items) {
								const { request, context } = item;
								for (const ext of finalResolveOptions.extensions) {
									if (request.endsWith(ext)) {
										newItems.push({
											context,
											request: request.slice(0, -ext.length)
										});
									}
								}
								if (!finalResolveOptions.enforceExtension) {
									newItems.push(item);
								}
							}
							items = newItems;

							newItems = [];
							for (const obj of items) {
								const { request, context } = obj;
								for (const mainFile of finalResolveOptions.mainFiles) {
									if (request.endsWith(`/${mainFile}`)) {
										newItems.push({
											context,
											request: request.slice(0, -mainFile.length)
										});
										newItems.push({
											context,
											request: request.slice(0, -mainFile.length - 1)
										});
									}
								}
								newItems.push(obj);
							}
							items = newItems;
						}

						newItems = [];
						for (const item of items) {
							let hideOriginal = false;
							for (const modulesItems of finalResolveOptions.modules) {
								if (Array.isArray(modulesItems)) {
									for (const dir of modulesItems) {
										if (item.request.startsWith(`./${dir}/`)) {
											newItems.push({
												context: item.context,
												request: item.request.slice(dir.length + 3)
											});
											hideOriginal = true;
										}
									}
								} else {
									const dir = modulesItems.replace(/\\/g, "/");
									const fullPath =
										item.context.replace(/\\/g, "/") + item.request.slice(1);
									if (fullPath.startsWith(dir)) {
										newItems.push({
											context: item.context,
											request: fullPath.slice(dir.length + 1)
										});
									}
								}
							}
							if (!hideOriginal) {
								newItems.push(item);
							}
						}
						return newItems;
					}
				);
			}
		);
	}
}
module.exports = RequireContextPlugin;
