"use strict";

const ExternalsPlugin = require("../ExternalsPlugin");


// Webpack.options.externalsPresets.electronMain
// Webpack.options.externalsPresets.electronPreload
// Webpack.options.externalsPresets.electronRenderer
class ElectronTargetPlugin {
	constructor(context) {
		this._context = context;
	}
	
	apply(compiler) {
		new ExternalsPlugin("node-commonjs", [
			"clipboard",
			"crash-reporter",
			"electron",
			"ipc",
			"native-image",
			"original-fs",
			"screen",
			"shell"
		]).apply(compiler);
		switch (this._context) {
			case "main":
				new ExternalsPlugin("node-commonjs", [
					"app",
					"auto-updater",
					"browser-window",
					"content-tracing",
					"dialog",
					"global-shortcut",
					"ipc-main",
					"menu",
					"menu-item",
					"power-monitor",
					"power-save-blocker",
					"protocol",
					"session",
					"tray",
					"web-contents"
				]).apply(compiler);
				break;
			case "preload":
			case "renderer":
				new ExternalsPlugin("node-commonjs", [
					"desktop-capturer",
					"ipc-renderer",
					"remote",
					"web-frame"
				]).apply(compiler);
				break;
		}
	}
}

module.exports = ElectronTargetPlugin;
