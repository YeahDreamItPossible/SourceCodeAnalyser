"use strict";

const EntryDependency = require("./dependencies/EntryDependency");

// 入口插件
class EntryPlugin {
	constructor(context, entry, options) {
		// Webpack.options.context
		this.context = context;
		// Webpack.options.entry.descriptor.import
		this.entry = entry;
		// Webpack.options.entry.descriptor
		this.options = options || "";
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"EntryPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					EntryDependency,
					normalModuleFactory
				);
			}
		);

		const { entry, options, context } = this;
		const dep = EntryPlugin.createDependency(entry, options);

		compiler.hooks.make.tapAsync("EntryPlugin", (compilation, callback) => {
			compilation.addEntry(context, dep, options, err => {
				callback(err);
			});
		});
	}

	// 返回 EntryDependency 的示例
	static createDependency(entry, options) {
		const dep = new EntryDependency(entry);
		// TODO webpack 6 remove string option
		dep.loc = { name: typeof options === "object" ? options.name : options };
		return dep;
	}
}

module.exports = EntryPlugin;
