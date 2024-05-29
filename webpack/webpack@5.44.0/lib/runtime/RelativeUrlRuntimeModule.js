"use strict";

const RuntimeGlobals = require("../RuntimeGlobals");
const Template = require("../Template");
const HelperRuntimeModule = require("./HelperRuntimeModule");

class RelativeUrlRuntimeModule extends HelperRuntimeModule {
	constructor() {
		super("relative url");
	}

	generate() {
		const { runtimeTemplate } = this.compilation;
		return Template.asString([
			`${RuntimeGlobals.relativeUrl} = function RelativeURL(url) {`,
			Template.indent([
				'var realUrl = new URL(url, "x:/");',
				"var values = {};",
				"for (var key in realUrl) values[key] = realUrl[key];",
				"values.href = url;",
				'values.pathname = url.replace(/[?#].*/, "");',
				'values.origin = values.protocol = "";',
				`values.toString = values.toJSON = ${runtimeTemplate.returningFunction(
					"url"
				)};`,
				"for (var key in values) Object.defineProperty(this, key, Object.assign({ enumerable: true, configurable: true, value: values[key] }));"
			]),
			"};",
			`${RuntimeGlobals.relativeUrl}.prototype = URL.prototype;`
		]);
	}
}

module.exports = RelativeUrlRuntimeModule;
