"use strict";

const makeSerializable = require("../util/makeSerializable");
const HarmonyImportDependency = require("./HarmonyImportDependency");

// ES模块接受更新导入依赖
// 热更新相关
class HarmonyAcceptImportDependency extends HarmonyImportDependency {
	constructor(request) {
		super(request, NaN);
		this.weak = true;
	}

	get type() {
		return "harmony accept";
	}
}

makeSerializable(
	HarmonyAcceptImportDependency,
	"webpack/lib/dependencies/HarmonyAcceptImportDependency"
);

HarmonyAcceptImportDependency.Template = class HarmonyAcceptImportDependencyTemplate extends (
	HarmonyImportDependency.Template
) {};

module.exports = HarmonyAcceptImportDependency;
