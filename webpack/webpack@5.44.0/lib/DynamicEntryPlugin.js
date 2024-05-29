"use strict";

const EntryOptionPlugin = require("./EntryOptionPlugin");
const EntryPlugin = require("./EntryPlugin");
const EntryDependency = require("./dependencies/EntryDependency");

/** @typedef {import("../declarations/WebpackOptions").EntryDynamicNormalized} EntryDynamic */
/** @typedef {import("../declarations/WebpackOptions").EntryItem} EntryItem */
/** @typedef {import("../declarations/WebpackOptions").EntryStaticNormalized} EntryStatic */
/** @typedef {import("./Compiler")} Compiler */

// 动态入口插件
class DynamicEntryPlugin {
	/**
	 * @param {string} context the context path
	 * @param {EntryDynamic} entry the entry value
	 */
	constructor(context, entry) {
		// Webpack.Config.context
		this.context = context;
		// Webpack.Config.entry
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
