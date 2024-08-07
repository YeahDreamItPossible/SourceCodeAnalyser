"use strict";

const ChunkGraph = require("./ChunkGraph");
const Entrypoint = require("./Entrypoint");
const { intersect } = require("./util/SetHelpers");
const SortableSet = require("./util/SortableSet");
const StringXor = require("./util/StringXor");
const {
	compareModulesByIdentifier,
	compareChunkGroupsByIndex,
	compareModulesById
} = require("./util/comparators");
const { createArrayToSetDeprecationSet } = require("./util/deprecation");
const { mergeRuntime } = require("./util/runtime");

/** @typedef {import("webpack-sources").Source} Source */
/** @typedef {import("./ChunkGraph").ChunkFilterPredicate} ChunkFilterPredicate */
/** @typedef {import("./ChunkGraph").ChunkSizeOptions} ChunkSizeOptions */
/** @typedef {import("./ChunkGraph").ModuleFilterPredicate} ModuleFilterPredicate */
/** @typedef {import("./ChunkGroup")} ChunkGroup */
/** @typedef {import("./Compilation")} Compilation */
/** @typedef {import("./Compilation").AssetInfo} AssetInfo */
/** @typedef {import("./Compilation").PathData} PathData */
/** @typedef {import("./Entrypoint").EntryOptions} EntryOptions */
/** @typedef {import("./Module")} Module */
/** @typedef {import("./ModuleGraph")} ModuleGraph */
/** @typedef {import("./util/Hash")} Hash */
/** @typedef {import("./util/runtime").RuntimeSpec} RuntimeSpec */

const ChunkFilesSet = createArrayToSetDeprecationSet("chunk.files");

/**
 * @typedef {Object} WithId an object who has an id property *
 * @property {string | number} id the id of the object
 */

/**
 * @deprecated
 * @typedef {Object} ChunkMaps
 * @property {Record<string|number, string>} hash
 * @property {Record<string|number, Record<string, string>>} contentHash
 * @property {Record<string|number, string>} name
 */

/**
 * @deprecated
 * @typedef {Object} ChunkModuleMaps
 * @property {Record<string|number, (string|number)[]>} id
 * @property {Record<string|number, string>} hash
 */

let debugId = 1000;

/**
 * 块出现的原因:
 * 我们书写的模块是零散的 需要用 块 来对这些模块的引用关系进行系统的记录
 */

/**
 * Chunk 分类:
 * RuntimeChunk 运行时块
 * (包含 webpack 在运行环境运行时所需的代码, 主要是用于处理模块的加载和依赖关系)
 * EntrypointChunk 入口块
 * (由 Webpack.options.Entry 生成的块, 是打包过程的入口点, 包含了应用程序的入口点模块及其依赖)
 */

// 块
// 作用:
// 块 是 模块(Module) 的封装单元 描述了对 模块 的使用信息
// 当 构建完成 时 块(Chunk) 被渲染成 捆(Bundle)
// 块 存储着 入口信息 和 对应的出口信息
// 在 ChunkGraph 中 能够 根据 块 找到对应的 模块信息 
class Chunk {
	constructor(name) {
		// 当前块Id
		// 根据 Webpack.options.optimization.chunkIds 配置 使用对应的算法得到对应的 Id
		this.id = null;
		// 
		// [ chunk.id ] (与 FlagIncludedChunksPlugin 相关)
		this.ids = null;
		// 调试debug(唯一标识符)
		this.debugId = debugId++;
		// 标识: 块名
		this.name = name;
		// 设置 chunk id 的提示(与 SplitChunksPlugin.options.CacheGroup.idHint 相关)
		// Set<String>
		this.idNameHints = new SortableSet();
		// 标识: 标识 当前块 能否被合并
		// RuntimeChunk.preventIntegration = true
		this.preventIntegration = false;
		// 块组(包含当前块的块组)
		// Set<ChunkGroup>
		this._groups = new SortableSet(undefined, compareChunkGroupsByIndex);
		// 运行时块名称(如果当前块需要额外的运行时块时)
		// 与 Webpack.options.Entry.runtime 相关
		this.runtime = undefined;
		// 输出文件名模板
		// 与 Webpack.options.Entry.filename 相关
		this.filenameTemplate = undefined;
		// 输出文件名(根据 Webpack.options.Entry.filename 得到的文件名) 
		// 示例: app.67f6cda2.js
		// Set<String>
		this.files = new ChunkFilesSet();
		// 保存的输出文件名 
		// 示例: app.ef02ca859b.js
		// Set<string>
		this.auxiliaryFiles = new Set();
		// 标识: 标识当前块是否已被渲染输出
		this.rendered = false;
		// 当前块完整哈希值
		this.hash = undefined;
		// 内容哈希
		// Record<String, String>
		this.contentHash = Object.create(null);
		// 当前块 渲染哈希值(默认对 this.hash 截取前20位)
		this.renderedHash = undefined;
		// 原因(描述当前块存在的原因)
		// String
		this.chunkReason = undefined;
		// 
		this.extraAsync = false;
	}

	// 返回 当前块 的 所有入口模块
	get entryModule() {
		const entryModules = Array.from(
			ChunkGraph.getChunkGraphForChunk(
				this,
				"Chunk.entryModule",
				"DEP_WEBPACK_CHUNK_ENTRY_MODULE"
			).getChunkEntryModulesIterable(this)
		);
		if (entryModules.length === 0) {
			return undefined;
		} else if (entryModules.length === 1) {
			return entryModules[0];
		} else {
			throw new Error(
				"Module.entryModule: Multiple entry modules are not supported by the deprecated API (Use the new ChunkGroup API)"
			);
		}
	}

	// 返回 当前块 是否有 入口模块
	hasEntryModule() {
		return (
			ChunkGraph.getChunkGraphForChunk(
				this,
				"Chunk.hasEntryModule",
				"DEP_WEBPACK_CHUNK_HAS_ENTRY_MODULE"
			).getNumberOfEntryModules(this) > 0
		);
	}

	// 绑定 当前块 与 当前模块 的关联关系
	addModule(module) {
		// 根据 Module 找到对应的 ChunkGraph
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.addModule",
			"DEP_WEBPACK_CHUNK_ADD_MODULE"
		);
		// 根据 Chunk 找到对应的 ChunkGraphChunk 然后判断 ChunkGraphChunk.modules 是否包含当前 Module
		if (chunkGraph.isModuleInChunk(module, this)) return false;
		// 绑定 Moduel 与 Chunk 的关联关系
		chunkGraph.connectChunkAndModule(this, module);
		return true;
	}

	// 解除 当前块 与 当前模块 的关联关系
	removeModule(module) {
		ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.removeModule",
			"DEP_WEBPACK_CHUNK_REMOVE_MODULE"
		).disconnectChunkAndModule(this, module);
	}

	// 返回 当前块 包含 模块 的数量
	getNumberOfModules() {
		return ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.getNumberOfModules",
			"DEP_WEBPACK_CHUNK_GET_NUMBER_OF_MODULES"
		).getNumberOfChunkModules(this);
	}

	// 返回 当前块 包含的 所有模块
	get modulesIterable() {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.modulesIterable",
			"DEP_WEBPACK_CHUNK_MODULES_ITERABLE"
		);
		return chunkGraph.getOrderedChunkModulesIterable(
			this,
			compareModulesByIdentifier
		);
	}

	// 比较两个 Chunk 的大小 返回 0 | 1 | -1
	compareTo(otherChunk) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.compareTo",
			"DEP_WEBPACK_CHUNK_COMPARE_TO"
		);
		return chunkGraph.compareChunks(this, otherChunk);
	}

	// 返回 当前块 是否包含 当前模块
	containsModule(module) {
		return ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.containsModule",
			"DEP_WEBPACK_CHUNK_CONTAINS_MODULE"
		).isModuleInChunk(module, this);
	}

	//  以 Set 形式返回 当前块 下的 所有模块
	getModules() {
		return ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.getModules",
			"DEP_WEBPACK_CHUNK_GET_MODULES"
		).getChunkModules(this);
	}

	// 移除 当前块 与对应 所有模块 的关联关系
	remove() {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.remove",
			"DEP_WEBPACK_CHUNK_REMOVE"
		);
		chunkGraph.disconnectChunk(this);
		this.disconnectFromGroups();
	}

	// 重新绑定 当前模块 与 另一个块 的关联关系
	moveModule(module, otherChunk) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.moveModule",
			"DEP_WEBPACK_CHUNK_MOVE_MODULE"
		);
		// 移除 当前块 与 当前模块 的关联关系
		chunkGraph.disconnectChunkAndModule(this, module);
		// 绑定 当前模块 与 另一个块 的关联关系
		chunkGraph.connectChunkAndModule(otherChunk, module);
	}

	// 返回 当前块 和 另外一个块 是否已经被成功合并
	integrate(otherChunk) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.integrate",
			"DEP_WEBPACK_CHUNK_INTEGRATE"
		);
		if (chunkGraph.canChunksBeIntegrated(this, otherChunk)) {
			chunkGraph.integrateChunks(this, otherChunk);
			return true;
		} else {
			return false;
		}
	}

	// 返回 当前块 能否与 另外一个块 进行合并
	canBeIntegrated(otherChunk) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.canBeIntegrated",
			"DEP_WEBPACK_CHUNK_CAN_BE_INTEGRATED"
		);
		return chunkGraph.canChunksBeIntegrated(this, otherChunk);
	}

	// 返回 当前块 是否是 空块
	// 即: 当前 Chunk 是否包含 Module
	isEmpty() {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.isEmpty",
			"DEP_WEBPACK_CHUNK_IS_EMPTY"
		);
		return chunkGraph.getNumberOfChunkModules(this) === 0;
	}

	// 返回 当前块 下 所有模块 的大小之和
	modulesSize() {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.modulesSize",
			"DEP_WEBPACK_CHUNK_MODULES_SIZE"
		);
		return chunkGraph.getChunkModulesSize(this);
	}

	// 返回 当前块 的大小
	size(options = {}) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.size",
			"DEP_WEBPACK_CHUNK_SIZE"
		);
		return chunkGraph.getChunkSize(this, options);
	}

	// 返回 当前块 与 另外一个块 合并后的 块 大小
	integratedSize(otherChunk, options) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.integratedSize",
			"DEP_WEBPACK_CHUNK_INTEGRATED_SIZE"
		);
		return chunkGraph.getIntegratedChunksSize(this, otherChunk, options);
	}

	/**
	 * @param {ModuleFilterPredicate} filterFn function used to filter modules
	 * @returns {ChunkModuleMaps} module map information
	 */
	// TODO:
	// 返回 Module 集合信息
	getChunkModuleMaps(filterFn) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.getChunkModuleMaps",
			"DEP_WEBPACK_CHUNK_GET_CHUNK_MODULE_MAPS"
		);
		// Record<string|number, (string|number)[]>
		const chunkModuleIdMap = Object.create(null);
		// Record<string|number, string>
		const chunkModuleHashMap = Object.create(null);
		for (const asyncChunk of this.getAllAsyncChunks()) {
			/** @type {(string|number)[]} */
			let array;
			for (const module of chunkGraph.getOrderedChunkModulesIterable(
				asyncChunk,
				compareModulesById(chunkGraph)
			)) {
				if (filterFn(module)) {
					if (array === undefined) {
						array = [];
						chunkModuleIdMap[asyncChunk.id] = array;
					}
					const moduleId = chunkGraph.getModuleId(module);
					array.push(moduleId);
					chunkModuleHashMap[moduleId] = chunkGraph.getRenderedModuleHash(
						module,
						undefined
					);
				}
			}
		}

		return {
			id: chunkModuleIdMap,
			hash: chunkModuleHashMap
		};
	}

	/**
	 * @param {ModuleFilterPredicate} filterFn predicate function used to filter modules
	 * @param {ChunkFilterPredicate=} filterChunkFn predicate function used to filter chunks
	 * @returns {boolean} return true if module exists in graph
	 */
	hasModuleInGraph(filterFn, filterChunkFn) {
		const chunkGraph = ChunkGraph.getChunkGraphForChunk(
			this,
			"Chunk.hasModuleInGraph",
			"DEP_WEBPACK_CHUNK_HAS_MODULE_IN_GRAPH"
		);
		return chunkGraph.hasModuleInGraph(this, filterFn, filterChunkFn);
	}

	/**
	 * @deprecated
	 * @param {boolean} realHash whether the full hash or the rendered hash is to be used
	 * @returns {ChunkMaps} the chunk map information
	 */
	// 返回 Chunk Map 信息
	getChunkMaps(realHash) {
		// Record<string|number, string>
		const chunkHashMap = Object.create(null);
		// Record<string|number, Record<string, string>>
		const chunkContentHashMap = Object.create(null);
		// Record<string|number, string>
		const chunkNameMap = Object.create(null);

		for (const chunk of this.getAllAsyncChunks()) {
			chunkHashMap[chunk.id] = realHash ? chunk.hash : chunk.renderedHash;
			for (const key of Object.keys(chunk.contentHash)) {
				if (!chunkContentHashMap[key]) {
					chunkContentHashMap[key] = Object.create(null);
				}
				chunkContentHashMap[key][chunk.id] = chunk.contentHash[key];
			}
			if (chunk.name) {
				chunkNameMap[chunk.id] = chunk.name;
			}
		}

		return {
			hash: chunkHashMap,
			contentHash: chunkContentHashMap,
			name: chunkNameMap
		};
	}

	// 返回当前 Chunk 是否是运行时块
	hasRuntime() {
		// 判断当前 Chunk 的 _groups 中 ChunkGrop.runtimeChunk === this
		for (const chunkGroup of this._groups) {
			if (
				chunkGroup instanceof Entrypoint &&
				chunkGroup.getRuntimeChunk() === this
			) {
				return true;
			}
		}
		return false;
	}

	// 返回 当前 Chunk 是否是初始块
	canBeInitial() {
		for (const chunkGroup of this._groups) {
			// 当前 ChunkGroup 是否是异步
			if (chunkGroup.isInitial()) return true;
		}
		return false;
	}

	// 返回 当前块 是否是唯一的初始块
	isOnlyInitial() {
		if (this._groups.size <= 0) return false;
		for (const chunkGroup of this._groups) {
			if (!chunkGroup.isInitial()) return false;
		}
		return true;
	}

	// 返回 Entrypoint.options
	getEntryOptions() {
		for (const chunkGroup of this._groups) {
			if (chunkGroup instanceof Entrypoint) {
				return chunkGroup.options;
			}
		}
		return undefined;
	}

	// 添加 ChunkGroup
	addGroup(chunkGroup) {
		this._groups.add(chunkGroup);
	}

	// 移除 ChunkGroup
	removeGroup(chunkGroup) {
		this._groups.delete(chunkGroup);
	}

	// 返回 是否包含当前 ChunkGroup
	isInGroup(chunkGroup) {
		return this._groups.has(chunkGroup);
	}

	// 返回当前 Chunk 的 ChunkGroup 大小
	getNumberOfGroups() {
		return this._groups.size;
	}

	// 返回排序后的 ChunkGroup
	get groupsIterable() {
		this._groups.sort();
		return this._groups;
	}

	// 将当前 Chunk 从 ChunkGroup 移除
	disconnectFromGroups() {
		for (const chunkGroup of this._groups) {
			chunkGroup.removeChunk(this);
		}
	}

	/**
	 * @param {Chunk} newChunk the new chunk that will be split out of
	 * @returns {void}
	 */
	split(newChunk) {
		for (const chunkGroup of this._groups) {
			chunkGroup.insertChunk(newChunk, this);
			newChunk.addGroup(chunkGroup);
		}
		for (const idHint of this.idNameHints) {
			newChunk.idNameHints.add(idHint);
		}
		newChunk.runtime = mergeRuntime(newChunk.runtime, this.runtime);
	}

	// 更新当前 Chunk hash
	updateHash(hash, chunkGraph) {
		hash.update(`${this.id} `);
		hash.update(this.ids ? this.ids.join(",") : "");
		hash.update(`${this.name || ""} `);
		const xor = new StringXor();
		for (const m of chunkGraph.getChunkModulesIterable(this)) {
			xor.add(chunkGraph.getModuleHash(m, this.runtime));
		}
		xor.updateHash(hash);
		const entryModules =
			chunkGraph.getChunkEntryModulesWithChunkGroupIterable(this);
		for (const [m, chunkGroup] of entryModules) {
			hash.update("entry");
			hash.update(`${chunkGraph.getModuleId(m)}`);
			hash.update(chunkGroup.id);
		}
	}

	// 以 Set 形式返回所有的异步块
	getAllAsyncChunks() {
		const queue = new Set();
		const chunks = new Set();

		// 返回当前 Chunk._groups 下的所有 Chunk
		const initialChunks = intersect(
			Array.from(this.groupsIterable, g => new Set(g.chunks))
		);

		const initialQueue = new Set(this.groupsIterable);

		for (const chunkGroup of initialQueue) {
			for (const child of chunkGroup.childrenIterable) {
				if (child instanceof Entrypoint) {
					initialQueue.add(child);
				} else {
					queue.add(child);
				}
			}
		}

		for (const chunkGroup of queue) {
			for (const chunk of chunkGroup.chunks) {
				if (!initialChunks.has(chunk)) {
					chunks.add(chunk);
				}
			}
			for (const child of chunkGroup.childrenIterable) {
				queue.add(child);
			}
		}

		return chunks;
	}

	/**
	 * @returns {Set<Chunk>} a set of all the initial chunks (including itself)
	 */
	// 以 Set 的形式返回所有的异步 ChunkGroup
	getAllInitialChunks() {
		const chunks = new Set();
		const queue = new Set(this.groupsIterable);
		for (const group of queue) {
			if (group.isInitial()) {
				for (const c of group.chunks) chunks.add(c);
				for (const g of group.childrenIterable) queue.add(g);
			}
		}
		return chunks;
	}

	// 以 Set 的形式返回与当前 Chunk 相关的 Chunk 集合 
	getAllReferencedChunks() {
		const queue = new Set(this.groupsIterable);
		const chunks = new Set();

		for (const chunkGroup of queue) {
			for (const chunk of chunkGroup.chunks) {
				chunks.add(chunk);
			}
			for (const child of chunkGroup.childrenIterable) {
				queue.add(child);
			}
		}

		return chunks;
	}

	// 以 Set 的形式返回与当前 Chunk 相关的 异步入口点 集合
	getAllReferencedAsyncEntrypoints() {
		const queue = new Set(this.groupsIterable);
		const entrypoints = new Set();

		for (const chunkGroup of queue) {
			for (const entrypoint of chunkGroup.asyncEntrypointsIterable) {
				entrypoints.add(entrypoint);
			}
			for (const child of chunkGroup.childrenIterable) {
				queue.add(child);
			}
		}

		return entrypoints;
	}

	/**
	 * @returns {boolean} true, if the chunk references async chunks
	 */
	hasAsyncChunks() {
		const queue = new Set();

		const initialChunks = intersect(
			Array.from(this.groupsIterable, g => new Set(g.chunks))
		);

		for (const chunkGroup of this.groupsIterable) {
			for (const child of chunkGroup.childrenIterable) {
				queue.add(child);
			}
		}

		for (const chunkGroup of queue) {
			for (const chunk of chunkGroup.chunks) {
				if (!initialChunks.has(chunk)) {
					return true;
				}
			}
			for (const child of chunkGroup.childrenIterable) {
				queue.add(child);
			}
		}

		return false;
	}

	/**
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @param {ChunkFilterPredicate=} filterFn function used to filter chunks
	 * @returns {Record<string, (string | number)[]>} a record object of names to lists of child ids(?)
	 */
	getChildIdsByOrders(chunkGraph, filterFn) {
		/** @type {Map<string, {order: number, group: ChunkGroup}[]>} */
		const lists = new Map();
		for (const group of this.groupsIterable) {
			if (group.chunks[group.chunks.length - 1] === this) {
				for (const childGroup of group.childrenIterable) {
					for (const key of Object.keys(childGroup.options)) {
						if (key.endsWith("Order")) {
							const name = key.substr(0, key.length - "Order".length);
							let list = lists.get(name);
							if (list === undefined) {
								list = [];
								lists.set(name, list);
							}
							list.push({
								order: childGroup.options[key],
								group: childGroup
							});
						}
					}
				}
			}
		}
		/** @type {Record<string, (string | number)[]>} */
		const result = Object.create(null);
		for (const [name, list] of lists) {
			list.sort((a, b) => {
				const cmp = b.order - a.order;
				if (cmp !== 0) return cmp;
				return a.group.compareTo(chunkGraph, b.group);
			});
			/** @type {Set<string | number>} */
			const chunkIdSet = new Set();
			for (const item of list) {
				for (const chunk of item.group.chunks) {
					if (filterFn && !filterFn(chunk, chunkGraph)) continue;
					chunkIdSet.add(chunk.id);
				}
			}
			if (chunkIdSet.size > 0) {
				result[name] = Array.from(chunkIdSet);
			}
		}
		return result;
	}

	/**
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @param {string} type option name
	 * @returns {{ onChunks: Chunk[], chunks: Set<Chunk> }[]} referenced chunks for a specific type
	 */
	getChildrenOfTypeInOrder(chunkGraph, type) {
		const list = [];
		for (const group of this.groupsIterable) {
			for (const childGroup of group.childrenIterable) {
				const order = childGroup.options[type];
				if (order === undefined) continue;
				list.push({
					order,
					group,
					childGroup
				});
			}
		}
		if (list.length === 0) return undefined;
		list.sort((a, b) => {
			const cmp = b.order - a.order;
			if (cmp !== 0) return cmp;
			return a.group.compareTo(chunkGraph, b.group);
		});
		const result = [];
		let lastEntry;
		for (const { group, childGroup } of list) {
			if (lastEntry && lastEntry.onChunks === group.chunks) {
				for (const chunk of childGroup.chunks) {
					lastEntry.chunks.add(chunk);
				}
			} else {
				result.push(
					(lastEntry = {
						onChunks: group.chunks,
						chunks: new Set(childGroup.chunks)
					})
				);
			}
		}
		return result;
	}

	/**
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @param {boolean=} includeDirectChildren include direct children (by default only children of async children are included)
	 * @param {ChunkFilterPredicate=} filterFn function used to filter chunks
	 * @returns {Record<string|number, Record<string, (string | number)[]>>} a record object of names to lists of child ids(?) by chunk id
	 */
	getChildIdsByOrdersMap(chunkGraph, includeDirectChildren, filterFn) {
		/** @type {Record<string|number, Record<string, (string | number)[]>>} */
		const chunkMaps = Object.create(null);

		/**
		 * @param {Chunk} chunk a chunk
		 * @returns {void}
		 */
		const addChildIdsByOrdersToMap = chunk => {
			const data = chunk.getChildIdsByOrders(chunkGraph, filterFn);
			for (const key of Object.keys(data)) {
				let chunkMap = chunkMaps[key];
				if (chunkMap === undefined) {
					chunkMaps[key] = chunkMap = Object.create(null);
				}
				chunkMap[chunk.id] = data[key];
			}
		};

		if (includeDirectChildren) {
			/** @type {Set<Chunk>} */
			const chunks = new Set();
			for (const chunkGroup of this.groupsIterable) {
				for (const chunk of chunkGroup.chunks) {
					chunks.add(chunk);
				}
			}
			for (const chunk of chunks) {
				addChildIdsByOrdersToMap(chunk);
			}
		}

		for (const chunk of this.getAllAsyncChunks()) {
			addChildIdsByOrdersToMap(chunk);
		}

		return chunkMaps;
	}
}

module.exports = Chunk;
