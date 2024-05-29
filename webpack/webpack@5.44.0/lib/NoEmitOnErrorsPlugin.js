"use strict";

/**
 * 当 编译有错误 时 默认要发送静态资源
 * 默认 Webpack.Config.optimization.emitOnErrors = true
 * 当启用当前插件时 或者 Webpack.Config.optimization.emitOnErrors = false 时 编译出错时将不再发送静态资源
 */
class NoEmitOnErrorsPlugin {
	apply(compiler) {
		compiler.hooks.shouldEmit.tap("NoEmitOnErrorsPlugin", compilation => {
			if (compilation.getStats().hasErrors()) return false;
		});
		compiler.hooks.compilation.tap("NoEmitOnErrorsPlugin", compilation => {
			compilation.hooks.shouldRecord.tap("NoEmitOnErrorsPlugin", () => {
				if (compilation.getStats().hasErrors()) return false;
			});
		});
	}
}

module.exports = NoEmitOnErrorsPlugin;
