"use strict";

const PrefetchDependency = require("./dependencies/PrefetchDependency");

// TODO:
// 预获取插件
// 作用:
// 
class PrefetchPlugin {
	constructor(context, request) {
		if (request) {
			this.context = context;
			this.request = request;
		} else {
			this.context = null;
			this.request = context;
		}
	}

	apply(compiler) {
		compiler.hooks.compilation.tap(
			"PrefetchPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					PrefetchDependency,
					normalModuleFactory
				);
			}
		);
		compiler.hooks.make.tapAsync("PrefetchPlugin", (compilation, callback) => {
			compilation.addModuleChain(
				this.context || compiler.context,
				new PrefetchDependency(this.request),
				err => {
					callback(err);
				}
			);
		});
	}
}

module.exports = PrefetchPlugin;
