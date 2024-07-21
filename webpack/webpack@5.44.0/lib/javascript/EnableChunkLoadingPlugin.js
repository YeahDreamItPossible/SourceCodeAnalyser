"use strict";

// WeakMap<Compiler, Set<ChunkLoadingType>>
const enabledTypes = new WeakMap();

const getEnabledTypes = compiler => {
	let set = enabledTypes.get(compiler);
	if (set === undefined) {
		set = new Set();
		enabledTypes.set(compiler, set);
	}
	return set;
};

// 根据 Webpack.options.output.enabledChunkLoadingTypes 值注册不同的插件
// jsonp | import | require | node-async | import-scripts
// 保证块加载插件
// 作用:
// 保证 块(chunk) 在不同的环境 以不同的方式加载
// 在 web 环境中 以 jsonp 的方式加载
// 在 node 环境中 以 require 同步加载 或者 以 async-node 的方式异步加载
// 在 webworker 环境中 以 import-scripts 的方式加载
class EnableChunkLoadingPlugin {
	constructor(type) {
		// Webpack.options.output.enabledChunkLoadingTypes
		this.type = type;
	}

	// 使用 自定义类型 的 块加载方式
	static setEnabled(compiler, type) {
		getEnabledTypes(compiler).add(type);
	}

	// 检查 某种块加载方式 是否存在
	static checkEnabled(compiler, type) {
		if (!getEnabledTypes(compiler).has(type)) {
			throw new Error(
				`Chunk loading type "${type}" is not enabled. ` +
					"EnableChunkLoadingPlugin need to be used to enable this type of chunk loading. " +
					'This usually happens through the "output.enabledChunkLoadingTypes" option. ' +
					'If you are using a function as entry which sets "chunkLoading", you need to add all potential chunk loading types to "output.enabledChunkLoadingTypes". ' +
					"These types are enabled: " +
					Array.from(getEnabledTypes(compiler)).join(", ")
			);
		}
	}

	apply(compiler) {
		const { type } = this;

		// Only enable once
		const enabled = getEnabledTypes(compiler);
		if (enabled.has(type)) return;
		enabled.add(type);

		if (typeof type === "string") {
			switch (type) {
				case "jsonp": {
					const JsonpChunkLoadingPlugin = require("../web/JsonpChunkLoadingPlugin");
					new JsonpChunkLoadingPlugin().apply(compiler);
					break;
				}
				case "import-scripts": {
					const ImportScriptsChunkLoadingPlugin = require("../webworker/ImportScriptsChunkLoadingPlugin");
					new ImportScriptsChunkLoadingPlugin().apply(compiler);
					break;
				}
				case "require": {
					const CommonJsChunkLoadingPlugin = require("../node/CommonJsChunkLoadingPlugin");
					new CommonJsChunkLoadingPlugin({
						asyncChunkLoading: false
					}).apply(compiler);
					break;
				}
				case "async-node": {
					const CommonJsChunkLoadingPlugin = require("../node/CommonJsChunkLoadingPlugin");
					new CommonJsChunkLoadingPlugin({
						asyncChunkLoading: true
					}).apply(compiler);
					break;
				}
				case "import": {
					const ModuleChunkLoadingPlugin = require("../esm/ModuleChunkLoadingPlugin");
					new ModuleChunkLoadingPlugin().apply(compiler);
					break;
				}
				case "universal":
					throw new Error("Universal Chunk Loading is not implemented yet");
				default:
					throw new Error(`Unsupported chunk loading type ${type}.
Plugins which provide custom chunk loading types must call EnableChunkLoadingPlugin.setEnabled(compiler, type) to disable this error.`);
			}
		} else {
			// TODO support plugin instances here
			// apply them to the compiler
		}
	}
}

module.exports = EnableChunkLoadingPlugin;
