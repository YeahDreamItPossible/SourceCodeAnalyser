"use strict";

const createSchemaValidation = require("./util/create-schema-validation");

// 验证 IgnorePlugins.options
const validate = createSchemaValidation(
	require("../schemas/plugins/IgnorePlugin.check.js"),
	() => require("../schemas/plugins/IgnorePlugin.json"),
	{
		name: "Ignore Plugin",
		baseDataPath: "options"
	}
);

// 忽视插件
// 如果 NormalModuleFactory | ContextModuleFactory 在 beforeResolve 时
// 如果 满足 匹配规则 则会跳过构建
class IgnorePlugin {
	constructor(options) {
		validate(options);
		this.options = options;

		this.checkIgnore = this.checkIgnore.bind(this);
	}

	/**
	 * Note that if "contextRegExp" is given, both the "resourceRegExp"
	 * and "contextRegExp" have to match.
	 *
	 * @param {ResolveData} resolveData resolve data
	 * @returns {false|undefined} returns false when the request should be ignored, otherwise undefined
	 */
	checkIgnore(resolveData) {
		if (
			"checkResource" in this.options &&
			this.options.checkResource &&
			this.options.checkResource(resolveData.request, resolveData.context)
		) {
			return false;
		}

		if (
			"resourceRegExp" in this.options &&
			this.options.resourceRegExp &&
			this.options.resourceRegExp.test(resolveData.request)
		) {
			if ("contextRegExp" in this.options && this.options.contextRegExp) {
				// if "contextRegExp" is given,
				// both the "resourceRegExp" and "contextRegExp" have to match.
				if (this.options.contextRegExp.test(resolveData.context)) {
					return false;
				}
			} else {
				return false;
			}
		}
	}

	apply(compiler) {
		compiler.hooks.normalModuleFactory.tap("IgnorePlugin", nmf => {
			nmf.hooks.beforeResolve.tap("IgnorePlugin", this.checkIgnore);
		});
		compiler.hooks.contextModuleFactory.tap("IgnorePlugin", cmf => {
			cmf.hooks.beforeResolve.tap("IgnorePlugin", this.checkIgnore);
		});
	}
}

module.exports = IgnorePlugin;
