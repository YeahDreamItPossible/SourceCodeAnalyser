"use strict";

const DefinePlugin = require("./DefinePlugin");
const WebpackError = require("./WebpackError");

// 环境插件
// 作用: 定义 进程 中环境变量 process.env
// 底层是对 DefinePlugin 中 process.env 快捷方式 
class EnvironmentPlugin {
	constructor(...keys) {
		if (keys.length === 1 && Array.isArray(keys[0])) {
			this.keys = keys[0];
			this.defaultValues = {};
		} else if (keys.length === 1 && keys[0] && typeof keys[0] === "object") {
			this.keys = Object.keys(keys[0]);
			this.defaultValues = keys[0];
		} else {
			this.keys = keys;
			this.defaultValues = {};
		}
	}

	apply(compiler) {
		/** @type {Record<string, CodeValue>} */
		const definitions = {};
		for (const key of this.keys) {
			const value =
				process.env[key] !== undefined
					? process.env[key]
					: this.defaultValues[key];

			if (value === undefined) {
				compiler.hooks.thisCompilation.tap("EnvironmentPlugin", compilation => {
					const error = new WebpackError(
						`EnvironmentPlugin - ${key} environment variable is undefined.\n\n` +
							"You can pass an object with default values to suppress this warning.\n" +
							"See https://webpack.js.org/plugins/environment-plugin for example."
					);

					error.name = "EnvVariableNotDefinedError";
					compilation.errors.push(error);
				});
			}

			definitions[`process.env.${key}`] =
				value === undefined ? "undefined" : JSON.stringify(value);
		}

		new DefinePlugin(definitions).apply(compiler);
	}
}

module.exports = EnvironmentPlugin;
