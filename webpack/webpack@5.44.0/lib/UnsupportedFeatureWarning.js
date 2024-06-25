"use strict";

const WebpackError = require("./WebpackError");
const makeSerializable = require("./util/makeSerializable");

// 不支持特征警告
class UnsupportedFeatureWarning extends WebpackError {
	/**
	 * @param {string} message description of warning
	 * @param {DependencyLocation} loc location start and end positions of the module
	 */
	constructor(message, loc) {
		super(message);

		this.name = "UnsupportedFeatureWarning";
		this.loc = loc;
		this.hideStack = true;
	}
}

makeSerializable(
	UnsupportedFeatureWarning,
	"webpack/lib/UnsupportedFeatureWarning"
);

module.exports = UnsupportedFeatureWarning;
