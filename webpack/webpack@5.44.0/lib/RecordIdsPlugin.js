"use strict";

const { compareNumbers } = require("./util/comparators");
const identifierUtils = require("./util/identifier");

// 记录Id插件
// 作用:
// 将 模块 和 块 的 Id 信息缓存到预设的目录文件中
// 描述:
// 告知 webpack 生成带有相对路径的记录(records)使得可以移动上下文目录。
// 默认 optimization.portableRecords 被禁用
// 如果下列至少一个选项在 webpack 中被设置
// Wepback.options.recordsPath || Webpack.options.recordsInputPath || Webpack.options.recordsOutputPath
// 该选项也会自动启用
class RecordIdsPlugin {
	constructor(options) {
		// Webpack.options.optimization.portableRecords
		this.options = options || {};
	}

	apply(compiler) {
		const portableIds = this.options.portableIds;

		const makePathsRelative =
			identifierUtils.makePathsRelative.bindContextCache(
				compiler.context,
				compiler.root
			);

		// compilation.records.modules 路径是相对路径还是绝对路径
		const getModuleIdentifier = module => {
			// 相对路径
			if (portableIds) {
				return makePathsRelative(module.identifier());
			}
			// 绝对路径
			return module.identifier();
		};

		compiler.hooks.compilation.tap("RecordIdsPlugin", compilation => {
			// 记录 模块Id
			// 设置 compiler.records.modules 属性
			// compiler.records 与 compilation.records 指向同一个内存地址
			compilation.hooks.recordModules.tap(
				"RecordIdsPlugin",
				(modules, records) => {
					const chunkGraph = compilation.chunkGraph;
					if (!records.modules) records.modules = {};
					if (!records.modules.byIdentifier) records.modules.byIdentifier = {};
					// Set<Number>
					const usedIds = new Set();
					for (const module of modules) {
						const moduleId = chunkGraph.getModuleId(module);
						// 只有当 模块Id 是 纯数字 时才会记录
						if (typeof moduleId !== "number") continue;
						const identifier = getModuleIdentifier(module);
						// 以 模块标识符 为 Key 以 模块Id 为值
						records.modules.byIdentifier[identifier] = moduleId;
						// 存储当前模块Id
						usedIds.add(moduleId);
					}
					records.modules.usedIds = Array.from(usedIds).sort(compareNumbers);
				}
			);

			// 从 缓存 中读取数据 给对应的 模块 设置Id
			// 读取 compiler.records.modules 中缓存的 id 信息 给 对应的模块 设置Id
			// 给 Module 对应的 ChunkGraphModule 设置id
			// 即: chunkGraphModule.id = xx
			compilation.hooks.reviveModules.tap(
				"RecordIdsPlugin",
				(modules, records) => {
					if (!records.modules) return;
					if (records.modules.byIdentifier) {
						const chunkGraph = compilation.chunkGraph;
						// Set<number>
						const usedIds = new Set();
						for (const module of modules) {
							const moduleId = chunkGraph.getModuleId(module);
							if (moduleId !== null) continue;
							const identifier = getModuleIdentifier(module);
							const id = records.modules.byIdentifier[identifier];
							if (id === undefined) continue;
							if (usedIds.has(id)) continue;
							usedIds.add(id);
							chunkGraph.setModuleId(module, id);
						}
					}
					if (Array.isArray(records.modules.usedIds)) {
						compilation.usedModuleIds = new Set(records.modules.usedIds);
					}
				}
			);

			/**
			 * @param {Chunk} chunk the chunk
			 * @returns {string[]} sources of the chunk
			 */
			const getChunkSources = chunk => {
				/** @type {string[]} */
				const sources = [];
				for (const chunkGroup of chunk.groupsIterable) {
					const index = chunkGroup.chunks.indexOf(chunk);
					if (chunkGroup.name) {
						sources.push(`${index} ${chunkGroup.name}`);
					} else {
						for (const origin of chunkGroup.origins) {
							if (origin.module) {
								if (origin.request) {
									sources.push(
										`${index} ${getModuleIdentifier(origin.module)} ${
											origin.request
										}`
									);
								} else if (typeof origin.loc === "string") {
									sources.push(
										`${index} ${getModuleIdentifier(origin.module)} ${
											origin.loc
										}`
									);
								} else if (
									origin.loc &&
									typeof origin.loc === "object" &&
									"start" in origin.loc
								) {
									sources.push(
										`${index} ${getModuleIdentifier(
											origin.module
										)} ${JSON.stringify(origin.loc.start)}`
									);
								}
							}
						}
					}
				}
				return sources;
			};

			// 记录 块Id
			// 设置 compiler.records.chunks 属性
			// compiler.records 与 compilation.records 指向同一个内存地址
			// 设置 compilation.records.chunks 属性
			compilation.hooks.recordChunks.tap(
				"RecordIdsPlugin",
				/**
				 * @param {Chunk[]} chunks the chunks array
				 * @param {Records} records the records object
				 * @returns {void}
				 */
				(chunks, records) => {
					if (!records.chunks) records.chunks = {};
					if (!records.chunks.byName) records.chunks.byName = {};
					if (!records.chunks.bySource) records.chunks.bySource = {};
					// Set<Number>
					const usedIds = new Set();
					for (const chunk of chunks) {
						// 只有当 块Id 是 纯数字 时才会记录
						if (typeof chunk.id !== "number") continue;
						const name = chunk.name;
						// // 以 块名 为 Key 以 块Id 为值
						if (name) records.chunks.byName[name] = chunk.id;
						const sources = getChunkSources(chunk);
						// 
						for (const source of sources) {
							records.chunks.bySource[source] = chunk.id;
						}
						// 存储当前块Id
						usedIds.add(chunk.id);
					}
					records.chunks.usedIds = Array.from(usedIds).sort(compareNumbers);
				}
			);

			// 从 缓存 中读取数据 给对应的 块 设置Id
			// 读取 compiler.records.chunks 中缓存的 id 信息 给对应的 块 设置Id
			// 即: chunk.id = xx chunk.ids = [xx]
			compilation.hooks.reviveChunks.tap(
				"RecordIdsPlugin",
				(chunks, records) => {
					if (!records.chunks) return;
					// Set<Number>
					const usedIds = new Set();
					if (records.chunks.byName) {
						for (const chunk of chunks) {
							if (chunk.id !== null) continue;
							if (!chunk.name) continue;
							const id = records.chunks.byName[chunk.name];
							if (id === undefined) continue;
							if (usedIds.has(id)) continue;
							usedIds.add(id);
							chunk.id = id;
							chunk.ids = [id];
						}
					}
					if (records.chunks.bySource) {
						for (const chunk of chunks) {
							if (chunk.id !== null) continue;
							const sources = getChunkSources(chunk);
							for (const source of sources) {
								const id = records.chunks.bySource[source];
								if (id === undefined) continue;
								if (usedIds.has(id)) continue;
								usedIds.add(id);
								chunk.id = id;
								chunk.ids = [id];
								break;
							}
						}
					}
					if (Array.isArray(records.chunks.usedIds)) {
						compilation.usedChunkIds = new Set(records.chunks.usedIds);
					}
				}
			);
		});
	}
}
module.exports = RecordIdsPlugin;
