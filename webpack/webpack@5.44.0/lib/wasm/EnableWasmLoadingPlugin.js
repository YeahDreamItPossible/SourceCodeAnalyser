"use strict";

// WeakMap<Compiler, Set<WasmLoadingType>>
const enabledTypes = new WeakMap();
const getEnabledTypes = compiler => {
	let set = enabledTypes.get(compiler);
	if (set === undefined) {
		set = new Set();
		enabledTypes.set(compiler, set);
	}
	return set;
};

// 确保 wasm 加载插件
// 根据 Webpack.options.output.enabledWasmLoadingTypes 值 注册插件
// fetch |"async-node-module | async-node
class EnableWasmLoadingPlugin {
	constructor(type) {
		this.type = type;
	}

	// 添加 自定义wasm加载类型
	static setEnabled(compiler, type) {
		getEnabledTypes(compiler).add(type);
	}

	// 检查 某中wasm加载类型 是否存在
	static checkEnabled(compiler, type) {
		if (!getEnabledTypes(compiler).has(type)) {
			throw new Error(
				`Library type "${type}" is not enabled. ` +
					"EnableWasmLoadingPlugin need to be used to enable this type of wasm loading. " +
					'This usually happens through the "output.enabledWasmLoadingTypes" option. ' +
					'If you are using a function as entry which sets "wasmLoading", you need to add all potential library types to "output.enabledWasmLoadingTypes". ' +
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
				case "fetch": {
					// TODO webpack 6 remove FetchCompileWasmPlugin
					const FetchCompileWasmPlugin = require("../web/FetchCompileWasmPlugin");
					const FetchCompileAsyncWasmPlugin = require("../web/FetchCompileAsyncWasmPlugin");
					new FetchCompileWasmPlugin({
						mangleImports: compiler.options.optimization.mangleWasmImports
					}).apply(compiler);
					new FetchCompileAsyncWasmPlugin().apply(compiler);
					break;
				}
				case "async-node": {
					// TODO webpack 6 remove ReadFileCompileWasmPlugin
					const ReadFileCompileWasmPlugin = require("../node/ReadFileCompileWasmPlugin");
					// @ts-expect-error typescript bug for duplicate require
					const ReadFileCompileAsyncWasmPlugin = require("../node/ReadFileCompileAsyncWasmPlugin");
					new ReadFileCompileWasmPlugin({
						mangleImports: compiler.options.optimization.mangleWasmImports
					}).apply(compiler);
					new ReadFileCompileAsyncWasmPlugin({ type }).apply(compiler);
					break;
				}
				case "async-node-module": {
					// @ts-expect-error typescript bug for duplicate require
					const ReadFileCompileAsyncWasmPlugin = require("../node/ReadFileCompileAsyncWasmPlugin");
					new ReadFileCompileAsyncWasmPlugin({ type, import: true }).apply(
						compiler
					);
					break;
				}
				case "universal":
					throw new Error(
						"Universal WebAssembly Loading is not implemented yet"
					);
				default:
					throw new Error(`Unsupported wasm loading type ${type}.
Plugins which provide custom wasm loading types must call EnableWasmLoadingPlugin.setEnabled(compiler, type) to disable this error.`);
			}
		} else {
			// TODO support plugin instances here
			// apply them to the compiler
		}
	}
}

module.exports = EnableWasmLoadingPlugin;
