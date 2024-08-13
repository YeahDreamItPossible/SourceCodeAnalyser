"use strict";

const WebpackError = require("./WebpackError");

// Webpack选项遗弃插件
// 作用:
// 当 Webpack 选项中某个 属性 被废弃 但是被使用时 抛出错误
// Webpack.options.xx 被废弃 抛出错误
class WarnDeprecatedOptionPlugin {
	constructor(option, value, suggestion) {
		// 属性路径
		// Webpack.options
		this.option = option;
		// 属性
		// Webpack.options.[xx]
		this.value = value;
		// 建议
		this.suggestion = suggestion;
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap(
			"WarnDeprecatedOptionPlugin",
			compilation => {
				compilation.warnings.push(
					new DeprecatedOptionWarning(this.option, this.value, this.suggestion)
				);
			}
		);
	}
}

class DeprecatedOptionWarning extends WebpackError {
	constructor(option, value, suggestion) {
		super();

		this.name = "DeprecatedOptionWarning";
		this.message =
			"configuration\n" +
			`The value '${value}' for option '${option}' is deprecated. ` +
			`Use '${suggestion}' instead.`;
	}
}

module.exports = WarnDeprecatedOptionPlugin;
