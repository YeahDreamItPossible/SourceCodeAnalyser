"use strict";

const ArrayPushCallbackChunkFormatPlugin = require("../javascript/ArrayPushCallbackChunkFormatPlugin");
const EnableChunkLoadingPlugin = require("../javascript/EnableChunkLoadingPlugin");

// 在 WebWorker 环境下 利用 importScript 加载脚本
// 并将 非初始化块 格式 设置为 array-push 类型
// 即:
// Webpack.options.output.chunkLoading = 'import-scripts'
// Webpack.options.output.chunkFormat = 'array-push'
class WebWorkerTemplatePlugin {
	apply(compiler) {
		compiler.options.output.chunkLoading = "import-scripts";
		new ArrayPushCallbackChunkFormatPlugin().apply(compiler);
		new EnableChunkLoadingPlugin("import-scripts").apply(compiler);
	}
}
module.exports = WebWorkerTemplatePlugin;
