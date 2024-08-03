"use strict";

const EntryDependency = require("./dependencies/EntryDependency");

/**
 * entry: {
 * 		web: {
 * 			import: './src/web.js'
 * 		},
 * 		h5: {
 * 			import: './src/h5.js'
 * 		}
 * }
 */

/**
 * 入口选项:
 * 在 webpack 中 Webpack.options.entry 整个配置项 被称为 入口选项
 * 单项入口选项:
 * 在 webpack 中 Webpack.options.entry 整个配置选项中某个单独为 单页面应用 配置的选项 被称为 单项入口选项
 * 如上图代码中 entry.web | entry.h5 选项
 */

// 静态入口插件
// 作用:
// 创建 入口依赖 
// 并添加 编译入口 并开始编译
class EntryPlugin {
	constructor(context, entry, options) {
		// Webpack.options.context
		this.context = context;
		// 入口选项
		// Webpack.options
		this.entry = entry;
		// 某个单项入口选项
		// Webpack.options.Entry
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
			// 添加 编译入口 并开始编译
			compilation.addEntry(context, dep, options, err => {
				callback(err);
			});
		});
	}

	// 返回 入口依赖 的实例
	static createDependency(entry, options) {
		const dep = new EntryDependency(entry);
		// TODO webpack 6 remove string option
		dep.loc = { name: typeof options === "object" ? options.name : options };
		return dep;
	}
}

module.exports = EntryPlugin;
