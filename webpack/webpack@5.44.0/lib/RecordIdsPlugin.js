"use strict";

const { compareNumbers } = require("./util/comparators");
const identifierUtils = require("./util/identifier");

// TODO: 暂时不知道具体怎么使用
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
			// 设置 compilation.records.modules 属性
			compilation.hooks.recordModules.tap(
				"RecordIdsPlugin",
				(modules, records) => {
					const chunkGraph = compilation.chunkGraph;
					if (!records.modules) records.modules = {};
					if (!records.modules.byIdentifier) records.modules.byIdentifier = {};
					/** @type {Set<number>} */
					const usedIds = new Set();
					for (const module of modules) {
						const moduleId = chunkGraph.getModuleId(module);
						if (typeof moduleId !== "number") continue;
						const identifier = getModuleIdentifier(module);
						records.modules.byIdentifier[identifier] = moduleId;
						usedIds.add(moduleId);
					}
					records.modules.usedIds = Array.from(usedIds).sort(compareNumbers);
				}
			);

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
					/** @type {Set<number>} */
					const usedIds = new Set();
					for (const chunk of chunks) {
						if (typeof chunk.id !== "number") continue;
						const name = chunk.name;
						if (name) records.chunks.byName[name] = chunk.id;
						const sources = getChunkSources(chunk);
						for (const source of sources) {
							records.chunks.bySource[source] = chunk.id;
						}
						usedIds.add(chunk.id);
					}
					records.chunks.usedIds = Array.from(usedIds).sort(compareNumbers);
				}
			);
			// 设置 chunk.id
			compilation.hooks.reviveChunks.tap(
				"RecordIdsPlugin",
				/**
				 * @param {Chunk[]} chunks the chunks array
				 * @param {Records} records the records object
				 * @returns {void}
				 */
				(chunks, records) => {
					if (!records.chunks) return;
					/** @type {Set<number>} */
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
