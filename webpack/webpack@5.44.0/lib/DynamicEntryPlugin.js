"use strict";

const EntryOptionPlugin = require("./EntryOptionPlugin");
const EntryPlugin = require("./EntryPlugin");
const EntryDependency = require("./dependencies/EntryDependency");

// 动态入口插件
// 作用:
// 当 Webpack.options.entry 值为函数时 注册动态入口插件
// 执行 动态入口函数 后 
// 并根据 入口选项 
// 创建 入口依赖 
// 并添加 编译入口 并开始编译 
class DynamicEntryPlugin {
	constructor(context, entry) {
		// Webpack.options.context
		this.context = context;
		// Webpack.options.entry
		this.entry = entry;
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"DynamicEntryPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					EntryDependency,
					normalModuleFactory
				);
			}
		);

		compiler.hooks.make.tapPromise(
			"DynamicEntryPlugin",
			(compilation, callback) =>
				Promise.resolve(this.entry())
					.then(entry => {
						const promises = [];
						for (const name of Object.keys(entry)) {
							const desc = entry[name];
							const options = EntryOptionPlugin.entryDescriptionToOptions(
								compiler,
								name,
								desc
							);
							for (const entry of desc.import) {
								promises.push(
									new Promise((resolve, reject) => {
										compilation.addEntry(
											this.context,
											EntryPlugin.createDependency(entry, options),
											options,
											err => {
												if (err) return reject(err);
												resolve();
											}
										);
									})
								);
							}
						}
						return Promise.all(promises);
					})
					.then(x => {})
		);
	}
}

module.exports = DynamicEntryPlugin;
