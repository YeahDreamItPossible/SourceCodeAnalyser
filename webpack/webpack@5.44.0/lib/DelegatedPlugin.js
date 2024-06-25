"use strict";

const DelegatedModuleFactoryPlugin = require("./DelegatedModuleFactoryPlugin");
const DelegatedSourceDependency = require("./dependencies/DelegatedSourceDependency");

// TODO:
// 代理插件
class DelegatedPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"DelegatedPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					DelegatedSourceDependency,
					normalModuleFactory
				);
			}
		);

		compiler.hooks.compile.tap("DelegatedPlugin", ({ normalModuleFactory }) => {
			new DelegatedModuleFactoryPlugin({
				associatedObjectForCache: compiler.root,
				...this.options
			}).apply(normalModuleFactory);
		});
	}
}

module.exports = DelegatedPlugin;
