"use strict";

const { join, dirname } = require("./util/fs");

// 标准模块替换插件
// 允许 替换掉 满足匹配规则的 module.request
class NormalModuleReplacementPlugin {
	constructor(resourceRegExp, newResource) {
		// RegExp
		this.resourceRegExp = resourceRegExp;
		// String | ModuleReplacer
		this.newResource = newResource;
	}

	apply(compiler) {
		const resourceRegExp = this.resourceRegExp;
		const newResource = this.newResource;
		compiler.hooks.normalModuleFactory.tap(
			"NormalModuleReplacementPlugin",
			nmf => {
				nmf.hooks.beforeResolve.tap("NormalModuleReplacementPlugin", result => {
					if (resourceRegExp.test(result.request)) {
						if (typeof newResource === "function") {
							newResource(result);
						} else {
							result.request = newResource;
						}
					}
				});
				nmf.hooks.afterResolve.tap("NormalModuleReplacementPlugin", result => {
					const createData = result.createData;
					if (resourceRegExp.test(createData.resource)) {
						if (typeof newResource === "function") {
							newResource(result);
						} else {
							const fs = compiler.inputFileSystem;
							if (
								newResource.startsWith("/") ||
								(newResource.length > 1 && newResource[1] === ":")
							) {
								createData.resource = newResource;
							} else {
								createData.resource = join(
									fs,
									dirname(fs, createData.resource),
									newResource
								);
							}
						}
					}
				});
			}
		);
	}
}

module.exports = NormalModuleReplacementPlugin;
