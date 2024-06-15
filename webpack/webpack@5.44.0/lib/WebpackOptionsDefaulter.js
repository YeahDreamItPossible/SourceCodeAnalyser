"use strict";

const { applyWebpackOptionsDefaults } = require("./config/defaults");
const { getNormalizedWebpackOptions } = require("./config/normalization");

// webpack.WebpackOptionsDefaulter 已被 webpack.config.getNormalizedWebpackOptions 和 webpack.config.applyWebpackOptionsDefaults 替代
// 返回 标准化 并应用默认值 的 Webpack.options
class WebpackOptionsDefaulter {
	process(options) {
		options = getNormalizedWebpackOptions(options);
		applyWebpackOptionsDefaults(options);
		return options;
	}
}

module.exports = WebpackOptionsDefaulter;
