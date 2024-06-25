"use strict";

const WebpackError = require("./WebpackError");

// Webpack.options.mode 字段缺失警告
module.exports = class NoModeWarning extends WebpackError {
	constructor() {
		super();

		this.name = "NoModeWarning";
		this.message =
			"configuration\n" +
			"The 'mode' option has not been set, webpack will fallback to 'production' for this value.\n" +
			"Set 'mode' option to 'development' or 'production' to enable defaults for each environment.\n" +
			"You can also set it to 'none' to disable any default behavior. " +
			"Learn more: https://webpack.js.org/configuration/mode/";
	}
};
