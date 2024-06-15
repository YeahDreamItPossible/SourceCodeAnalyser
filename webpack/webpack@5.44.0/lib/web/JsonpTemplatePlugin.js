"use strict";

const ArrayPushCallbackChunkFormatPlugin = require("../javascript/ArrayPushCallbackChunkFormatPlugin");
const EnableChunkLoadingPlugin = require("../javascript/EnableChunkLoadingPlugin");
const JsonpChunkLoadingRuntimeModule = require("./JsonpChunkLoadingRuntimeModule");

// 
class JsonpTemplatePlugin {
	static getCompilationHooks(compilation) {
		return JsonpChunkLoadingRuntimeModule.getCompilationHooks(compilation);
	}

	apply(compiler) {
		compiler.options.output.chunkLoading = "jsonp";
		new ArrayPushCallbackChunkFormatPlugin().apply(compiler);
		new EnableChunkLoadingPlugin("jsonp").apply(compiler);
	}
}

module.exports = JsonpTemplatePlugin;
