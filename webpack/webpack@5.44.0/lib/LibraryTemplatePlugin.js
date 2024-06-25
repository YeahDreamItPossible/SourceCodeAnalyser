"use strict";

const EnableLibraryPlugin = require("./library/EnableLibraryPlugin");

// TODO:
// 
// webpack 6 将会移除这个类
class LibraryTemplatePlugin {
	/**
	 * @param {LibraryName} name name of library
	 * @param {LibraryType} target type of library
	 * @param {UmdNamedDefine} umdNamedDefine setting this to true will name the UMD module
	 * @param {AuxiliaryComment} auxiliaryComment comment in the UMD wrapper
	 * @param {LibraryExport} exportProperty which export should be exposed as library
	 */
	constructor(name, target, umdNamedDefine, auxiliaryComment, exportProperty) {
		this.library = {
			type: target || "var",
			name,
			umdNamedDefine,
			auxiliaryComment,
			export: exportProperty
		};
	}

	apply(compiler) {
		const { output } = compiler.options;
		output.library = this.library;
		new EnableLibraryPlugin(this.library.type).apply(compiler);
	}
}

module.exports = LibraryTemplatePlugin;
