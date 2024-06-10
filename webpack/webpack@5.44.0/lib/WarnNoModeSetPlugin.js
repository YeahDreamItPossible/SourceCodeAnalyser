"use strict";

const NoModeWarning = require("./NoModeWarning");

// 警告 Webpack.Config.mode 字段缺失
class WarnNoModeSetPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap("WarnNoModeSetPlugin", compilation => {
			compilation.warnings.push(new NoModeWarning());
		});
	}
}

module.exports = WarnNoModeSetPlugin;
