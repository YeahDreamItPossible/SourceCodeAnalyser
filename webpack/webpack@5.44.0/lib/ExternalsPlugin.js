/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const ExternalModuleFactoryPlugin = require("./ExternalModuleFactoryPlugin");

/** @typedef {import("../declarations/WebpackOptions").Externals} Externals */
/** @typedef {import("./Compiler")} Compiler */

/**
 * 从输出的bundle中排除依赖(以cdn的方式引入的依赖)
 * 根据Webpack.Config.externals和Webpack.Config.externalsType字段配置
 */
class ExternalsPlugin {
	/**
	 * @param {string | undefined} type default external type
	 * @param {Externals} externals externals config
	 */
	constructor(type, externals) {
		this.type = type;
		this.externals = externals;
	}

	/**
	 * Apply the plugin
	 * @param {Compiler} compiler the compiler instance
	 * @returns {void}
	 */
	apply(compiler) {
		compiler.hooks.compile.tap("ExternalsPlugin", ({ normalModuleFactory }) => {
			new ExternalModuleFactoryPlugin(this.type, this.externals).apply(
				normalModuleFactory
			);
		});
	}
}

module.exports = ExternalsPlugin;
