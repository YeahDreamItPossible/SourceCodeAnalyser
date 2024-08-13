"use strict";

const NoModeWarning = require("./NoModeWarning");

// 编译模式缺失警告插件
// 作用:
// 警告 Webpack.options.mode 字段缺失
class WarnNoModeSetPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap("WarnNoModeSetPlugin", compilation => {
			compilation.warnings.push(new NoModeWarning());
		});
	}
}

module.exports = WarnNoModeSetPlugin;
