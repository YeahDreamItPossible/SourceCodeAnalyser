"use strict";

const CommonJsChunkFormatPlugin = require("../javascript/CommonJsChunkFormatPlugin");
const EnableChunkLoadingPlugin = require("../javascript/EnableChunkLoadingPlugin");


class NodeTemplatePlugin {
	constructor(options) {
		this._options = options || {};
	}

	apply(compiler) {
		const chunkLoading = this._options.asyncChunkLoading
			? "async-node"
			: "require";
		compiler.options.output.chunkLoading = chunkLoading;
		new CommonJsChunkFormatPlugin().apply(compiler);
		new EnableChunkLoadingPlugin(chunkLoading).apply(compiler);
	}
}

module.exports = NodeTemplatePlugin;
