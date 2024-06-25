"use strict";

const asyncLib = require("neo-async");
const NormalModule = require("./NormalModule");
const PrefetchDependency = require("./dependencies/PrefetchDependency");

// TODO:
// 自动预拉取插件
// 会观察之前编译的 所有模块 的变化 以改进增量构建的时间
class AutomaticPrefetchPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"AutomaticPrefetchPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					PrefetchDependency,
					normalModuleFactory
				);
			}
		);
		let lastModules = null;
		compiler.hooks.afterCompile.tap("AutomaticPrefetchPlugin", compilation => {
			lastModules = [];

			for (const m of compilation.modules) {
				if (m instanceof NormalModule) {
					lastModules.push({
						context: m.context,
						request: m.request
					});
				}
			}
		});
		compiler.hooks.make.tapAsync(
			"AutomaticPrefetchPlugin",
			(compilation, callback) => {
				if (!lastModules) return callback();
				asyncLib.forEach(
					lastModules,
					(m, callback) => {
						compilation.addModuleChain(
							m.context || compiler.context,
							new PrefetchDependency(`!!${m.request}`),
							callback
						);
					},
					err => {
						lastModules = null;
						callback(err);
					}
				);
			}
		);
	}
}
module.exports = AutomaticPrefetchPlugin;
