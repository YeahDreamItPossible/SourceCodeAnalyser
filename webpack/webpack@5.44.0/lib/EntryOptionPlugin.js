"use strict";

// 入口选项插件
// 作用:
// 根据 Webpack.options.entry 不同值 注册不同的入口插件
class EntryOptionPlugin {
	apply(compiler) {
		compiler.hooks.entryOption.tap("EntryOptionPlugin", (context, entry) => {
			EntryOptionPlugin.applyEntryOption(compiler, context, entry);
			return true;
		});
	}

	// 使用 Webpack.options.Entry 值类型 注册入口插件
	static applyEntryOption(compiler, context, entry) {
		// 动态入口
		if (typeof entry === "function") {
			const DynamicEntryPlugin = require("./DynamicEntryPlugin");
			new DynamicEntryPlugin(context, entry).apply(compiler);
		} 
		// 静态入口
		else {
			const EntryPlugin = require("./EntryPlugin");
			// 单页面应用 或者 多页面应用
			for (const name of Object.keys(entry)) {
				const desc = entry[name];
				const options = EntryOptionPlugin.entryDescriptionToOptions(
					compiler,
					name,
					desc
				);
				for (const entry of desc.import) {
					new EntryPlugin(context, entry, options).apply(compiler);
				}
			}
		}
	}

	// 返回标准化后的 Webpack.options.Entry 选项 并根据不同的选项值注册不同的插件
	static entryDescriptionToOptions(compiler, name, desc) {
		const options = {
			name,
			filename: desc.filename, // 
			runtime: desc.runtime,
			layer: desc.layer,
			dependOn: desc.dependOn,
			publicPath: desc.publicPath,
			chunkLoading: desc.chunkLoading,
			wasmLoading: desc.wasmLoading,
			library: desc.library
		};
		if (desc.layer !== undefined && !compiler.options.experiments.layers) {
			throw new Error(
				"'entryOptions.layer' is only allowed when 'experiments.layers' is enabled"
			);
		}
		if (desc.chunkLoading) {
			const EnableChunkLoadingPlugin = require("./javascript/EnableChunkLoadingPlugin");
			EnableChunkLoadingPlugin.checkEnabled(compiler, desc.chunkLoading);
		}
		if (desc.wasmLoading) {
			const EnableWasmLoadingPlugin = require("./wasm/EnableWasmLoadingPlugin");
			EnableWasmLoadingPlugin.checkEnabled(compiler, desc.wasmLoading);
		}
		if (desc.library) {
			const EnableLibraryPlugin = require("./library/EnableLibraryPlugin");
			EnableLibraryPlugin.checkEnabled(compiler, desc.library.type);
		}
		return options;
	}
}

module.exports = EntryOptionPlugin;
