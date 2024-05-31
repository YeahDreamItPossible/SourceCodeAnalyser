"use strict";

// 将 optimization.runtimeChunk 设置为 true 或 'multiple'，
// 会为每个入口添加一个只含有 runtime 的额外 chunk。
// 根据 Webpack.Config.optimization.runtimeChunk 注册该插件
class RuntimeChunkPlugin {
	constructor(options) {
		this.options = {
			name: entrypoint => `runtime~${entrypoint.name}`,
			...options
		};
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap("RuntimeChunkPlugin", compilation => {
			compilation.hooks.addEntry.tap(
				"RuntimeChunkPlugin",
				(_, { name: entryName }) => {
					if (entryName === undefined) return;
					const data = compilation.entries.get(entryName);
					if (data.options.runtime === undefined && !data.options.dependOn) {
						// Determine runtime chunk name
						let name = this.options.name;
						if (typeof name === "function") {
							name = name({ name: entryName });
						}
						data.options.runtime = name;
					}
				}
			);
		});
	}
}

module.exports = RuntimeChunkPlugin;
