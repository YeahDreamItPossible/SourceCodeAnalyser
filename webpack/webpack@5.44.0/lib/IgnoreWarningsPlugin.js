"use strict";

// 忽视警告插件
// 作用:
// 根据 自定义的匹配规则 来忽视编译过程中出现的 webpack 警告
class IgnoreWarningsPlugin {
	constructor(ignoreWarnings) {
		// Webpack.options.ignoreWarnings
		this._ignoreWarnings = ignoreWarnings;
	}

	apply(compiler) {
		// 筛选warnings 并返回warnings
		compiler.hooks.compilation.tap("IgnoreWarningsPlugin", compilation => {
			compilation.hooks.processWarnings.tap(
				"IgnoreWarningsPlugin",
				warnings => {
					return warnings.filter(warning => {
						return !this._ignoreWarnings.some(ignore =>
							ignore(warning, compilation)
						);
					});
				}
			);
		});
	}
}

module.exports = IgnoreWarningsPlugin;
