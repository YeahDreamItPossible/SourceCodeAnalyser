/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Ivan Kopeykin @vankop
*/

"use strict";

const makeSerializable = require("../util/makeSerializable");
const ModuleDependency = require("./ModuleDependency");
const ModuleDependencyTemplateAsId = require("./ModuleDependencyTemplateAsId");

// TODO:
// HMR 相关
class ImportMetaHotDeclineDependency extends ModuleDependency {
	constructor(request, range) {
		super(request);

		this.range = range;
		this.weak = true;
	}

	get type() {
		return "import.meta.webpackHot.decline";
	}

	get category() {
		return "esm";
	}
}

makeSerializable(
	ImportMetaHotDeclineDependency,
	"webpack/lib/dependencies/ImportMetaHotDeclineDependency"
);

ImportMetaHotDeclineDependency.Template = ModuleDependencyTemplateAsId;

module.exports = ImportMetaHotDeclineDependency;
