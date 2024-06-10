"use strict";

// 根据 Webpack.Config.Entry 注册插件
class EntryOptionPlugin {
	apply(compiler) {
		compiler.hooks.entryOption.tap("EntryOptionPlugin", (context, entry) => {
			EntryOptionPlugin.applyEntryOption(compiler, context, entry);
			return true;
		});
	}

	// 使用 Webpack.Config.Entry 值类型 注册入口插件
	static applyEntryOption(compiler, context, entry) {
		if (typeof entry === "function") {
			// 动态入口
			const DynamicEntryPlugin = require("./DynamicEntryPlugin");
			new DynamicEntryPlugin(context, entry).apply(compiler);
		} else {
			// 静态入口
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

	// 根据 Webpack.Config.entry.descriptor 的值注册插件 并返回 Webpack.Config.entry.descriptor
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
