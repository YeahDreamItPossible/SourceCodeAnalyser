"use strict";

const util = require("util");
const Entrypoint = require("./Entrypoint");
const ModuleGraphConnection = require("./ModuleGraphConnection");
const { first } = require("./util/SetHelpers");
const SortableSet = require("./util/SortableSet");
const {
	compareModulesById,
	compareIterables,
	compareModulesByIdentifier,
	concatComparators,
	compareSelect,
	compareIds
} = require("./util/comparators");
const createHash = require("./util/createHash");
const findGraphRoots = require("./util/findGraphRoots");
const {
	RuntimeSpecMap,
	RuntimeSpecSet,
	runtimeToString,
	mergeRuntime,
	forEachRuntime
} = require("./util/runtime");

/** @typedef {import("./AsyncDependenciesBlock")} AsyncDependenciesBlock */
/** @typedef {import("./Chunk")} Chunk */
/** @typedef {import("./ChunkGroup")} ChunkGroup */
/** @typedef {import("./Module")} Module */
/** @typedef {import("./ModuleGraph")} ModuleGraph */
/** @typedef {import("./RuntimeModule")} RuntimeModule */
/** @typedef {import("./util/runtime").RuntimeSpec} RuntimeSpec */

/** @type {ReadonlySet<string>} */
const EMPTY_SET = new Set();

const ZERO_BIG_INT = BigInt(0);

const compareModuleIterables = compareIterables(compareModulesByIdentifier);

/** @typedef {(c: Chunk, chunkGraph: ChunkGraph) => boolean} ChunkFilterPredicate */
/** @typedef {(m: Module) => boolean} ModuleFilterPredicate */

// 模块哈希信息
class ModuleHashInfo {
	constructor(hash, renderedHash) {
		// 完整hash值
		this.hash = hash;
		// 截取长度后的hash值
		this.renderedHash = renderedHash;
	}
}

/** @template T @typedef {(set: SortableSet<T>) => T[]} SetToArrayFunction<T> */

// 返回 类Set值 的 Set 形式
const getArray = set => {
	return Array.from(set);
};

// 返回 Set<chunk.runtime>
const getModuleRuntimes = chunks => {
	const runtimes = new RuntimeSpecSet();
	for (const chunk of chunks) {
		runtimes.add(chunk.runtime);
	}
	return runtimes;
};

// 返回 Map<module.sourceType, Set<Module>>
const modulesBySourceType = set => {
	/** @type {Map<string, SortableSet<Module>>} */
	const map = new Map();
	for (const module of set) {
		for (const sourceType of module.getSourceTypes()) {
			let innerSet = map.get(sourceType);
			if (innerSet === undefined) {
				innerSet = new SortableSet();
				map.set(sourceType, innerSet);
			}
			innerSet.add(module);
		}
	}
	for (const [key, innerSet] of map) {
		// When all modules have the source type, we reuse the original SortableSet
		// to benefit from the shared cache (especially for sorting)
		if (innerSet.size === set.size) {
			map.set(key, set);
		}
	}
	return map;
};

/** @type {WeakMap<Function, any>} */
const createOrderedArrayFunctionMap = new WeakMap();

/**
 * @template T
 * @param {function(T, T): -1|0|1} comparator comparator function
 * @returns {SetToArrayFunction<T>} set as ordered array
 */
const createOrderedArrayFunction = comparator => {
	/** @type {SetToArrayFunction<T>} */
	let fn = createOrderedArrayFunctionMap.get(comparator);
	if (fn !== undefined) return fn;
	fn = set => {
		set.sortWith(comparator);
		return Array.from(set);
	};
	createOrderedArrayFunctionMap.set(comparator, fn);
	return fn;
};

// 返回所有的 Module 的大小之和
const getModulesSize = modules => {
	let size = 0;
	for (const module of modules) {
		for (const type of module.getSourceTypes()) {
			size += module.size(type);
		}
	}
	return size;
};

/**
 * @param {Iterable<Module>} modules the sortable Set to get the size of
 * @returns {Record<string, number>} the sizes of the modules
 */
const getModulesSizes = modules => {
	let sizes = Object.create(null);
	for (const module of modules) {
		for (const type of module.getSourceTypes()) {
			sizes[type] = (sizes[type] || 0) + module.size(type);
		}
	}
	return sizes;
};

/**
 * @param {Chunk} a chunk
 * @param {Chunk} b chunk
 * @returns {boolean} true, if a is always a parent of b
 */
const isAvailableChunk = (a, b) => {
	const queue = new Set(b.groupsIterable);
	for (const chunkGroup of queue) {
		if (a.isInGroup(chunkGroup)) continue;
		if (chunkGroup.isInitial()) return false;
		for (const parent of chunkGroup.parentsIterable) {
			queue.add(parent);
		}
	}
	return true;
};

// 当前 Module 属于哪些 Chunk
// Module => ChunkGraphModule
class ChunkGraphModule {
	constructor() {
		// 包含当前 Module 的 块
		// Set<Chunk>
		this.chunks = new SortableSet();
		// 包含当前 Module 的 入口块
		// Set<Chunk>
		this.entryInChunks = undefined;
		// 包含当前 Module 的 运行时块
		// Set<Chunk>
		this.runtimeInChunks = undefined;

		// Map<RuntimeChunk, ModuleHashInfo>
		this.hashes = undefined;

		// Module.id
		this.id = null;
		// 运行时所需要的与 webpack 相关的变量
		// RuntimeSpecMap<Set<string>> | undefined
		this.runtimeRequirements = undefined;
		// RuntimeSpecMap<string>
		this.graphHashes = undefined;
		// RuntimeSpecMap<string>
		this.graphHashesWithConnections = undefined;
	}
}

// 当前 Chunk 中所包含的 Module
// Chunk => ChunkGraphChunk
class ChunkGraphChunk {
	constructor() {
		// 当前 Chunk 所包含的Module
		// Set<Module>
		this.modules = new SortableSet();
		// 当前 Chunk 所包含的 RuntimeModule
		// Set<RuntimeModule>
		this.runtimeModules = new SortableSet();
		// 入口Module 与 入口点
		// Map<EntryModule, Entrypoint>
		this.entryModules = new Map();

		// TODO:
		/** @type {Set<RuntimeModule> | undefined} */
		this.fullHashModules = undefined;

		// 运行时所需要的与 webpack 相关的变量
		// 示例: __webpack_require__ __webpack_require__.o
		this.runtimeRequirements = undefined;
		// Set<string>
		this.runtimeRequirementsInTree = new Set();
	}
}

class ChunkGraph {
	constructor(moduleGraph) {
		// 记录当前 Module 属于哪些 Chunk
		// WeakMap<Module, ChunkGraphModule>
		this._modules = new WeakMap();
		// 记录当前 Chunk 有哪些 Module
		// WeakMap<Chunk, ChunkGraphChunk>
		this._chunks = new WeakMap();
		// 记录当前异步 Module 属于那些 ChunkGroup
		// WeakMap<AsyncDependenciesBlock, ChunkGroup>
		this._blockChunkGroups = new WeakMap();
		//
		// Map<String, String | number>
		this._runtimeIds = new Map();
		// ModuleGraph
		this.moduleGraph = moduleGraph;
		// 
		this._getGraphRoots = this._getGraphRoots.bind(this);

		// 缓存 便于数据查找
		this._cacheChunkGraphModuleKey1 = undefined;
		this._cacheChunkGraphModuleValue1 = undefined;
		this._cacheChunkGraphModuleKey2 = undefined;
		this._cacheChunkGraphModuleValue2 = undefined;
		// 缓存 便于数据查找
		this._cacheChunkGraphChunkKey1 = undefined;
		this._cacheChunkGraphChunkValue1 = undefined;
		this._cacheChunkGraphChunkKey2 = undefined;
		this._cacheChunkGraphChunkValue2 = undefined;
	}

	// 根据 Module 找到对应的 ChunkGraphModule
	_getChunkGraphModule(module) {
		if (this._cacheChunkGraphModuleKey1 === module)
			return this._cacheChunkGraphModuleValue1;
		if (this._cacheChunkGraphModuleKey2 === module)
			return this._cacheChunkGraphModuleValue2;
		let cgm = this._modules.get(module);
		if (cgm === undefined) {
			cgm = new ChunkGraphModule();
			this._modules.set(module, cgm);
		}
		this._cacheChunkGraphModuleKey2 = this._cacheChunkGraphModuleKey1;
		this._cacheChunkGraphModuleValue2 = this._cacheChunkGraphModuleValue1;
		this._cacheChunkGraphModuleKey1 = module;
		this._cacheChunkGraphModuleValue1 = cgm;
		return cgm;
	}

	// 根据 Chunk 找到对应的 ChunkGraphChunk
	_getChunkGraphChunk(chunk) {
		if (this._cacheChunkGraphChunkKey1 === chunk)
			return this._cacheChunkGraphChunkValue1;
		if (this._cacheChunkGraphChunkKey2 === chunk)
			return this._cacheChunkGraphChunkValue2;
		let cgc = this._chunks.get(chunk);
		if (cgc === undefined) {
			cgc = new ChunkGraphChunk();
			this._chunks.set(chunk, cgc);
		}
		this._cacheChunkGraphChunkKey2 = this._cacheChunkGraphChunkKey1;
		this._cacheChunkGraphChunkValue2 = this._cacheChunkGraphChunkValue1;
		this._cacheChunkGraphChunkKey1 = chunk;
		this._cacheChunkGraphChunkValue1 = cgc;
		return cgc;
	}

	/**
	 * @param {SortableSet<Module>} set the sortable Set to get the roots of
	 * @returns {Module[]} the graph roots
	 */
	_getGraphRoots(set) {
		const { moduleGraph } = this;
		return Array.from(
			findGraphRoots(set, module => {
				/** @type {Set<Module>} */
				const set = new Set();
				const addDependencies = module => {
					for (const connection of moduleGraph.getOutgoingConnections(module)) {
						if (!connection.module) continue;
						const activeState = connection.getActiveState(undefined);
						if (activeState === false) continue;
						if (activeState === ModuleGraphConnection.TRANSITIVE_ONLY) {
							addDependencies(connection.module);
							continue;
						}
						set.add(connection.module);
					}
				};
				addDependencies(module);
				return set;
			})
		).sort(compareModulesByIdentifier);
	}

	// 绑定 单个Module 与 单个Chunk 关联关系
	connectChunkAndModule(chunk, module) {
		const cgm = this._getChunkGraphModule(module);
		const cgc = this._getChunkGraphChunk(chunk);
		cgm.chunks.add(chunk);
		cgc.modules.add(module);
	}

	// 解除 单个Module 与 单个Chunk 关联关系
	disconnectChunkAndModule(chunk, module) {
		const cgm = this._getChunkGraphModule(module);
		const cgc = this._getChunkGraphChunk(chunk);
		cgc.modules.delete(module);
		cgm.chunks.delete(chunk);
	}

	// 解除 某个Chunk 与 所有Module 的关联关系
	disconnectChunk(chunk) {
		// 根据 Chunk 找到对应的 ChunkGraphChunk
		const cgc = this._getChunkGraphChunk(chunk);
		for (const module of cgc.modules) {
			// 根据 ChunkGraphChunk 中的 Module 找到对应的 ChunkGraphModule
			const cgm = this._getChunkGraphModule(module);
			// 解除 ChunkGraphModule 中 Module 与 Chunk 的关联关系
			cgm.chunks.delete(chunk);
		}
		// 
		cgc.modules.clear();
		chunk.disconnectFromGroups();
		ChunkGraph.clearChunkGraphForChunk(chunk);
	}

	// 单向绑定 Chunk 与 Module 的关联关系
	attachModules(chunk, modules) {
		const cgc = this._getChunkGraphChunk(chunk);
		for (const module of modules) {
			cgc.modules.add(module);
		}
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {Iterable<RuntimeModule>} modules the runtime modules
	 * @returns {void}
	 */
	attachRuntimeModules(chunk, modules) {
		const cgc = this._getChunkGraphChunk(chunk);
		for (const module of modules) {
			cgc.runtimeModules.add(module);
		}
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {Iterable<RuntimeModule>} modules the modules that require a full hash
	 * @returns {void}
	 */
	attachFullHashModules(chunk, modules) {
		const cgc = this._getChunkGraphChunk(chunk);
		if (cgc.fullHashModules === undefined) cgc.fullHashModules = new Set();
		for (const module of modules) {
			cgc.fullHashModules.add(module);
		}
	}

	/**
	 * @param {Module} oldModule the replaced module
	 * @param {Module} newModule the replacing module
	 * @returns {void}
	 */
	replaceModule(oldModule, newModule) {
		const oldCgm = this._getChunkGraphModule(oldModule);
		const newCgm = this._getChunkGraphModule(newModule);

		for (const chunk of oldCgm.chunks) {
			const cgc = this._getChunkGraphChunk(chunk);
			cgc.modules.delete(oldModule);
			cgc.modules.add(newModule);
			newCgm.chunks.add(chunk);
		}
		oldCgm.chunks.clear();

		if (oldCgm.entryInChunks !== undefined) {
			if (newCgm.entryInChunks === undefined) {
				newCgm.entryInChunks = new Set();
			}
			for (const chunk of oldCgm.entryInChunks) {
				const cgc = this._getChunkGraphChunk(chunk);
				const old = cgc.entryModules.get(oldModule);
				/** @type {Map<Module, Entrypoint>} */
				const newEntryModules = new Map();
				for (const [m, cg] of cgc.entryModules) {
					if (m === oldModule) {
						newEntryModules.set(newModule, old);
					} else {
						newEntryModules.set(m, cg);
					}
				}
				cgc.entryModules = newEntryModules;
				newCgm.entryInChunks.add(chunk);
			}
			oldCgm.entryInChunks = undefined;
		}

		if (oldCgm.runtimeInChunks !== undefined) {
			if (newCgm.runtimeInChunks === undefined) {
				newCgm.runtimeInChunks = new Set();
			}
			for (const chunk of oldCgm.runtimeInChunks) {
				const cgc = this._getChunkGraphChunk(chunk);
				cgc.runtimeModules.delete(/** @type {RuntimeModule} */ (oldModule));
				cgc.runtimeModules.add(/** @type {RuntimeModule} */ (newModule));
				newCgm.runtimeInChunks.add(chunk);
				if (
					cgc.fullHashModules !== undefined &&
					cgc.fullHashModules.has(/** @type {RuntimeModule} */ (oldModule))
				) {
					cgc.fullHashModules.delete(/** @type {RuntimeModule} */ (oldModule));
					cgc.fullHashModules.add(/** @type {RuntimeModule} */ (newModule));
				}
			}
			oldCgm.runtimeInChunks = undefined;
		}
	}

	// 根据Chunk 找到 ChunkGraphChunk 然后判断ChunkGraphChunk是否含有Module
	isModuleInChunk(module, chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.modules.has(module);
	}

	/**
	 * @param {Module} module the checked module
	 * @param {ChunkGroup} chunkGroup the checked chunk group
	 * @returns {boolean} true, if the chunk contains the module
	 */
	// 判断 ChunkGroup 中是否含有 Module
	isModuleInChunkGroup(module, chunkGroup) {
		for (const chunk of chunkGroup.chunks) {
			if (this.isModuleInChunk(module, chunk)) return true;
		}
		return false;
	}

	/**
	 * @param {Module} module the checked module
	 * @returns {boolean} true, if the module is entry of any chunk
	 */
	isEntryModule(module) {
		const cgm = this._getChunkGraphModule(module);
		return cgm.entryInChunks !== undefined;
	}

	// 返回当前Module 关联的所有Chunk
	getModuleChunksIterable(module) {
		const cgm = this._getChunkGraphModule(module);
		return cgm.chunks;
	}

	// 返回当前Module 关联的所有Chunk(根据特定排序方法排序后)
	getOrderedModuleChunksIterable(module, sortFn) {
		const cgm = this._getChunkGraphModule(module);
		cgm.chunks.sortWith(sortFn);
		return cgm.chunks;
	}

	/**
	 * @param {Module} module the module
	 * @returns {Chunk[]} array of chunks (cached, do not modify)
	 */
	getModuleChunks(module) {
		const cgm = this._getChunkGraphModule(module);
		return cgm.chunks.getFromCache(getArray);
	}

	/**
	 * @param {Module} module the module
	 * @returns {number} the number of chunk which contain the module
	 */
	getNumberOfModuleChunks(module) {
		const cgm = this._getChunkGraphModule(module);
		return cgm.chunks.size;
	}

	/**
	 * @param {Module} module the module
	 * @returns {RuntimeSpecSet} runtimes
	 */
	// 
	getModuleRuntimes(module) {
		const cgm = this._getChunkGraphModule(module);
		return cgm.chunks.getFromUnorderedCache(getModuleRuntimes);
	}

	// 返回 当前 Chunk 包含的 Module 的数量
	getNumberOfChunkModules(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.modules.size;
	}

	// 返回当前 Chunk 下的所有 Module
	// ChunkGraphChunk.modules
	getChunkModulesIterable(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.modules;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {string} sourceType source type
	 * @returns {Iterable<Module> | undefined} return the modules for this chunk
	 */
	getChunkModulesIterableBySourceType(chunk, sourceType) {
		const cgc = this._getChunkGraphChunk(chunk);
		const modulesWithSourceType = cgc.modules
			.getFromUnorderedCache(modulesBySourceType)
			.get(sourceType);
		return modulesWithSourceType;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {function(Module, Module): -1|0|1} comparator comparator function
	 * @returns {Iterable<Module>} return the modules for this chunk
	 */
	// 返回当前 Chunk 下的所有 Module
	// 返回 ChunkGraphChunk.modules
	getOrderedChunkModulesIterable(chunk, comparator) {
		const cgc = this._getChunkGraphChunk(chunk);
		cgc.modules.sortWith(comparator);
		return cgc.modules;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {string} sourceType source type
	 * @param {function(Module, Module): -1|0|1} comparator comparator function
	 * @returns {Iterable<Module> | undefined} return the modules for this chunk
	 */
	getOrderedChunkModulesIterableBySourceType(chunk, sourceType, comparator) {
		const cgc = this._getChunkGraphChunk(chunk);
		const modulesWithSourceType = cgc.modules
			.getFromUnorderedCache(modulesBySourceType)
			.get(sourceType);
		if (modulesWithSourceType === undefined) return undefined;
		modulesWithSourceType.sortWith(comparator);
		return modulesWithSourceType;
	}

	// 以 Set 形式返回当前 Chunk 下的所有 Module
	getChunkModules(chunk) {
		// 根据 Chunk 找到对应的 ChunkGraphChunk
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.modules.getFromUnorderedCache(getArray);
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {function(Module, Module): -1|0|1} comparator comparator function
	 * @returns {Module[]} return the modules for this chunk (cached, do not modify)
	 */
	getOrderedChunkModules(chunk, comparator) {
		const cgc = this._getChunkGraphChunk(chunk);
		const arrayFunction = createOrderedArrayFunction(comparator);
		return cgc.modules.getFromUnorderedCache(arrayFunction);
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {ModuleFilterPredicate} filterFn function used to filter modules
	 * @param {boolean} includeAllChunks all chunks or only async chunks
	 * @returns {Record<string|number, (string|number)[]>} chunk to module ids object
	 */
	getChunkModuleIdMap(chunk, filterFn, includeAllChunks = false) {
		/** @type {Record<string|number, (string|number)[]>} */
		const chunkModuleIdMap = Object.create(null);

		for (const asyncChunk of includeAllChunks
			? chunk.getAllReferencedChunks()
			: chunk.getAllAsyncChunks()) {
			/** @type {(string|number)[]} */
			let array;
			for (const module of this.getOrderedChunkModulesIterable(
				asyncChunk,
				compareModulesById(this)
			)) {
				if (filterFn(module)) {
					if (array === undefined) {
						array = [];
						chunkModuleIdMap[asyncChunk.id] = array;
					}
					const moduleId = this.getModuleId(module);
					array.push(moduleId);
				}
			}
		}

		return chunkModuleIdMap;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {ModuleFilterPredicate} filterFn function used to filter modules
	 * @param {number} hashLength length of the hash
	 * @param {boolean} includeAllChunks all chunks or only async chunks
	 * @returns {Record<string|number, Record<string|number, string>>} chunk to module id to module hash object
	 */
	getChunkModuleRenderedHashMap(
		chunk,
		filterFn,
		hashLength = 0,
		includeAllChunks = false
	) {
		/** @type {Record<string|number, Record<string|number, string>>} */
		const chunkModuleHashMap = Object.create(null);

		for (const asyncChunk of includeAllChunks
			? chunk.getAllReferencedChunks()
			: chunk.getAllAsyncChunks()) {
			/** @type {Record<string|number, string>} */
			let idToHashMap;
			for (const module of this.getOrderedChunkModulesIterable(
				asyncChunk,
				compareModulesById(this)
			)) {
				if (filterFn(module)) {
					if (idToHashMap === undefined) {
						idToHashMap = Object.create(null);
						chunkModuleHashMap[asyncChunk.id] = idToHashMap;
					}
					const moduleId = this.getModuleId(module);
					const hash = this.getRenderedModuleHash(module, asyncChunk.runtime);
					idToHashMap[moduleId] = hashLength ? hash.slice(0, hashLength) : hash;
				}
			}
		}

		return chunkModuleHashMap;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {ChunkFilterPredicate} filterFn function used to filter chunks
	 * @returns {Record<string|number, boolean>} chunk map
	 */
	getChunkConditionMap(chunk, filterFn) {
		const map = Object.create(null);
		for (const c of chunk.getAllReferencedChunks()) {
			map[c.id] = filterFn(c, this);
		}
		return map;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {ModuleFilterPredicate} filterFn predicate function used to filter modules
	 * @param {ChunkFilterPredicate=} filterChunkFn predicate function used to filter chunks
	 * @returns {boolean} return true if module exists in graph
	 */
	// 返回
	hasModuleInGraph(chunk, filterFn, filterChunkFn) {
		const queue = new Set(chunk.groupsIterable);
		const chunksProcessed = new Set();

		for (const chunkGroup of queue) {
			for (const innerChunk of chunkGroup.chunks) {
				if (!chunksProcessed.has(innerChunk)) {
					chunksProcessed.add(innerChunk);
					if (!filterChunkFn || filterChunkFn(innerChunk, this)) {
						for (const module of this.getChunkModulesIterable(innerChunk)) {
							if (filterFn(module)) {
								return true;
							}
						}
					}
				}
			}
			for (const child of chunkGroup.childrenIterable) {
				queue.add(child);
			}
		}
		return false;
	}

	// 比较 ChunkA 和 ChunkB 下包含 Module 数量的大小
	compareChunks(chunkA, chunkB) {
		const cgcA = this._getChunkGraphChunk(chunkA);
		const cgcB = this._getChunkGraphChunk(chunkB);
		if (cgcA.modules.size > cgcB.modules.size) return -1;
		if (cgcA.modules.size < cgcB.modules.size) return 1;
		cgcA.modules.sortWith(compareModulesByIdentifier);
		cgcB.modules.sortWith(compareModulesByIdentifier);
		return compareModuleIterables(cgcA.modules, cgcB.modules);
	}

	// 返回当前 Chunk 下所有的 Module 的大小之和
	getChunkModulesSize(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.modules.getFromUnorderedCache(getModulesSize);
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {Record<string, number>} total sizes of all modules in the chunk by source type
	 */
	getChunkModulesSizes(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.modules.getFromUnorderedCache(getModulesSizes);
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {Module[]} root modules of the chunks (ordered by identifier)
	 */
	getChunkRootModules(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.modules.getFromUnorderedCache(this._getGraphRoots);
	}

	// 根据选项返回 Chunk 的大小
	getChunkSize(chunk, options = {}) {
		// 根据 Chunk 找到对应的 ChunkGraphChunk
		const cgc = this._getChunkGraphChunk(chunk);
		// 返回 ChunkGraphChunk 下所有 Module 的大小之和
		const modulesSize = cgc.modules.getFromUnorderedCache(getModulesSize);
		const chunkOverhead =
			typeof options.chunkOverhead === "number" ? options.chunkOverhead : 10000;
		const entryChunkMultiplicator =
			typeof options.entryChunkMultiplicator === "number"
				? options.entryChunkMultiplicator
				: 10;
		return (
			chunkOverhead +
			modulesSize * (chunk.canBeInitial() ? entryChunkMultiplicator : 1)
		);
	}

	// 根据选项返回 ChunkA 与ChunkB 合并后的 Chunk 大小
	getIntegratedChunksSize(chunkA, chunkB, options = {}) {
		const cgcA = this._getChunkGraphChunk(chunkA);
		const cgcB = this._getChunkGraphChunk(chunkB);
		const allModules = new Set(cgcA.modules);
		for (const m of cgcB.modules) allModules.add(m);
		let modulesSize = getModulesSize(allModules);
		const chunkOverhead =
			typeof options.chunkOverhead === "number" ? options.chunkOverhead : 10000;
		const entryChunkMultiplicator =
			typeof options.entryChunkMultiplicator === "number"
				? options.entryChunkMultiplicator
				: 10;
		return (
			chunkOverhead +
			modulesSize *
				(chunkA.canBeInitial() || chunkB.canBeInitial()
					? entryChunkMultiplicator
					: 1)
		);
	}

	// 返回 两个 Chunk 能否被合成一个
	canChunksBeIntegrated(chunkA, chunkB) {
		// 先判断 Chunk 是否是运行时块(运行时块不允许被合并)
		if (chunkA.preventIntegration || chunkB.preventIntegration) {
			return false;
		}

		// 当前 Chunk 是否是运行时块
		const hasRuntimeA = chunkA.hasRuntime();
		const hasRuntimeB = chunkB.hasRuntime();

		if (hasRuntimeA !== hasRuntimeB) {
			if (hasRuntimeA) {
				return isAvailableChunk(chunkA, chunkB);
			} else if (hasRuntimeB) {
				return isAvailableChunk(chunkB, chunkA);
			} else {
				return false;
			}
		}

		// 如果 ChunkA 或者 ChunkB 有运行时模块
		if (
			this.getNumberOfEntryModules(chunkA) > 0 ||
			this.getNumberOfEntryModules(chunkB) > 0
		) {
			return false;
		}

		return true;
	}

	// 将 ChunkB 合并到 ChunkA 中
	integrateChunks(chunkA, chunkB) {
		// Decide for one name (deterministic)
		if (chunkA.name && chunkB.name) {
			if (
				this.getNumberOfEntryModules(chunkA) > 0 ===
				this.getNumberOfEntryModules(chunkB) > 0
			) {
				// When both chunks have entry modules or none have one, use
				// shortest name
				if (chunkA.name.length !== chunkB.name.length) {
					chunkA.name =
						chunkA.name.length < chunkB.name.length ? chunkA.name : chunkB.name;
				} else {
					chunkA.name = chunkA.name < chunkB.name ? chunkA.name : chunkB.name;
				}
			} else if (this.getNumberOfEntryModules(chunkB) > 0) {
				// Pick the name of the chunk with the entry module
				chunkA.name = chunkB.name;
			}
		} else if (chunkB.name) {
			chunkA.name = chunkB.name;
		}

		// Merge id name hints
		for (const hint of chunkB.idNameHints) {
			chunkA.idNameHints.add(hint);
		}

		// Merge runtime
		chunkA.runtime = mergeRuntime(chunkA.runtime, chunkB.runtime);

		// getChunkModules is used here to create a clone, because disconnectChunkAndModule modifies
		for (const module of this.getChunkModules(chunkB)) {
			this.disconnectChunkAndModule(chunkB, module);
			this.connectChunkAndModule(chunkA, module);
		}

		for (const [module, chunkGroup] of Array.from(
			this.getChunkEntryModulesWithChunkGroupIterable(chunkB)
		)) {
			this.disconnectChunkAndEntryModule(chunkB, module);
			this.connectChunkAndEntryModule(chunkA, module, chunkGroup);
		}

		for (const chunkGroup of chunkB.groupsIterable) {
			chunkGroup.replaceChunk(chunkB, chunkA);
			chunkA.addGroup(chunkGroup);
			chunkB.removeGroup(chunkGroup);
		}
		ChunkGraph.clearChunkGraphForChunk(chunkB);
	}

	/**
	 * @param {Module} module the checked module
	 * @param {Chunk} chunk the checked chunk
	 * @returns {boolean} true, if the chunk contains the module as entry
	 */
	isEntryModuleInChunk(module, chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.entryModules.has(module);
	}

	// 绑定 Module 与 Chunk 关联关系
	// Module => ChunkGraphModule
	// Chunk => ChunkGraphChunk
	connectChunkAndEntryModule(chunk, module, entrypoint) {
		const cgm = this._getChunkGraphModule(module);
		const cgc = this._getChunkGraphChunk(chunk);
		if (cgm.entryInChunks === undefined) {
			cgm.entryInChunks = new Set();
		}
		cgm.entryInChunks.add(chunk);
		cgc.entryModules.set(module, entrypoint);
	}

	/**
	 * @param {Chunk} chunk the new chunk
	 * @param {RuntimeModule} module the runtime module
	 * @returns {void}
	 */
	connectChunkAndRuntimeModule(chunk, module) {
		const cgm = this._getChunkGraphModule(module);
		const cgc = this._getChunkGraphChunk(chunk);
		if (cgm.runtimeInChunks === undefined) {
			cgm.runtimeInChunks = new Set();
		}
		cgm.runtimeInChunks.add(chunk);
		cgc.runtimeModules.add(module);
	}

	/**
	 * @param {Chunk} chunk the new chunk
	 * @param {RuntimeModule} module the module that require a full hash
	 * @returns {void}
	 */
	addFullHashModuleToChunk(chunk, module) {
		const cgc = this._getChunkGraphChunk(chunk);
		if (cgc.fullHashModules === undefined) cgc.fullHashModules = new Set();
		cgc.fullHashModules.add(module);
	}

	/**
	 * @param {Chunk} chunk the new chunk
	 * @param {Module} module the entry module
	 * @returns {void}
	 */
	disconnectChunkAndEntryModule(chunk, module) {
		const cgm = this._getChunkGraphModule(module);
		const cgc = this._getChunkGraphChunk(chunk);
		cgm.entryInChunks.delete(chunk);
		if (cgm.entryInChunks.size === 0) {
			cgm.entryInChunks = undefined;
		}
		cgc.entryModules.delete(module);
	}

	/**
	 * @param {Chunk} chunk the new chunk
	 * @param {RuntimeModule} module the runtime module
	 * @returns {void}
	 */
	disconnectChunkAndRuntimeModule(chunk, module) {
		const cgm = this._getChunkGraphModule(module);
		const cgc = this._getChunkGraphChunk(chunk);
		cgm.runtimeInChunks.delete(chunk);
		if (cgm.runtimeInChunks.size === 0) {
			cgm.runtimeInChunks = undefined;
		}
		cgc.runtimeModules.delete(module);
	}

	/**
	 * @param {Module} module the entry module, it will no longer be entry
	 * @returns {void}
	 */
	disconnectEntryModule(module) {
		const cgm = this._getChunkGraphModule(module);
		for (const chunk of cgm.entryInChunks) {
			const cgc = this._getChunkGraphChunk(chunk);
			cgc.entryModules.delete(module);
		}
		cgm.entryInChunks = undefined;
	}

	/**
	 * @param {Chunk} chunk the chunk, for which all entries will be removed
	 * @returns {void}
	 */
	disconnectEntries(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		for (const module of cgc.entryModules.keys()) {
			const cgm = this._getChunkGraphModule(module);
			cgm.entryInChunks.delete(chunk);
			if (cgm.entryInChunks.size === 0) {
				cgm.entryInChunks = undefined;
			}
		}
		cgc.entryModules.clear();
	}

	// 返回当前ChunkGraphChunk.entryModules
	getNumberOfEntryModules(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.entryModules.size;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {number} the amount of entry modules in chunk
	 */
	getNumberOfRuntimeModules(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.runtimeModules.size;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {Iterable<Module>} iterable of modules (do not modify)
	 */
	// 根据 Chunk 来获取入口模块 EntryModule
	getChunkEntryModulesIterable(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.entryModules.keys();
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {Iterable<Chunk>} iterable of chunks
	 */
	getChunkEntryDependentChunksIterable(chunk) {
		/** @type {Set<Chunk>} */
		const set = new Set();
		for (const chunkGroup of chunk.groupsIterable) {
			if (chunkGroup instanceof Entrypoint) {
				const entrypointChunk = chunkGroup.getEntrypointChunk();
				const cgc = this._getChunkGraphChunk(entrypointChunk);
				for (const chunkGroup of cgc.entryModules.values()) {
					for (const c of chunkGroup.chunks) {
						if (c !== chunk && c !== entrypointChunk && !c.hasRuntime()) {
							set.add(c);
						}
					}
				}
			}
		}

		return set;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {boolean} true, when it has dependent chunks
	 */
	hasChunkEntryDependentChunks(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		for (const chunkGroup of cgc.entryModules.values()) {
			for (const c of chunkGroup.chunks) {
				if (c !== chunk) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {Iterable<RuntimeModule>} iterable of modules (do not modify)
	 */
	getChunkRuntimeModulesIterable(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.runtimeModules;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {RuntimeModule[]} array of modules in order of execution
	 */
	getChunkRuntimeModulesInOrder(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		const array = Array.from(cgc.runtimeModules);
		array.sort(
			concatComparators(
				compareSelect(
					/**
					 * @param {RuntimeModule} r runtime module
					 * @returns {number=} stage
					 */
					r => r.stage,
					compareIds
				),
				compareModulesByIdentifier
			)
		);
		return array;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {Iterable<RuntimeModule> | undefined} iterable of modules (do not modify)
	 */
	getChunkFullHashModulesIterable(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.fullHashModules;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {ReadonlySet<RuntimeModule> | undefined} set of modules (do not modify)
	 */
	getChunkFullHashModulesSet(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.fullHashModules;
	}

	/** @typedef {[Module, Entrypoint | undefined]} EntryModuleWithChunkGroup */

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {Iterable<EntryModuleWithChunkGroup>} iterable of modules (do not modify)
	 */
	getChunkEntryModulesWithChunkGroupIterable(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.entryModules;
	}

	/**
	 * @param {AsyncDependenciesBlock} depBlock the async block
	 * @returns {ChunkGroup} the chunk group
	 */
	getBlockChunkGroup(depBlock) {
		return this._blockChunkGroups.get(depBlock);
	}

	/**
	 * @param {AsyncDependenciesBlock} depBlock the async block
	 * @param {ChunkGroup} chunkGroup the chunk group
	 * @returns {void}
	 */
	connectBlockAndChunkGroup(depBlock, chunkGroup) {
		this._blockChunkGroups.set(depBlock, chunkGroup);
		chunkGroup.addBlock(depBlock);
	}

	/**
	 * @param {ChunkGroup} chunkGroup the chunk group
	 * @returns {void}
	 */
	disconnectChunkGroup(chunkGroup) {
		for (const block of chunkGroup.blocksIterable) {
			this._blockChunkGroups.delete(block);
		}
		// TODO refactor by moving blocks list into ChunkGraph
		chunkGroup._blocks.clear();
	}

	// 返回 ChunkGraphModule.id
	getModuleId(module) {
		const cgm = this._getChunkGraphModule(module);
		return cgm.id;
	}

	// 设置模块ID
	setModuleId(module, id) {
		const cgm = this._getChunkGraphModule(module);
		cgm.id = id;
	}

	// 返回
	getRuntimeId(runtime) {
		return this._runtimeIds.get(runtime);
	}

	// 设置运行时id
	setRuntimeId(runtime, id) {
		this._runtimeIds.set(runtime, id);
	}

	/**
	 * @template T
	 * @param {Module} module the module
	 * @param {RuntimeSpecMap<T>} hashes hashes data
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {T} hash
	 */
	_getModuleHashInfo(module, hashes, runtime) {
		if (!hashes) {
			throw new Error(
				`Module ${module.identifier()} has no hash info for runtime ${runtimeToString(
					runtime
				)} (hashes not set at all)`
			);
		} else if (runtime === undefined) {
			const hashInfoItems = new Set(hashes.values());
			if (hashInfoItems.size !== 1) {
				throw new Error(
					`No unique hash info entry for unspecified runtime for ${module.identifier()} (existing runtimes: ${Array.from(
						hashes.keys(),
						r => runtimeToString(r)
					).join(", ")}).
Caller might not support runtime-dependent code generation (opt-out via optimization.usedExports: "global").`
				);
			}
			return first(hashInfoItems);
		} else {
			const hashInfo = hashes.get(runtime);
			if (!hashInfo) {
				throw new Error(
					`Module ${module.identifier()} has no hash info for runtime ${runtimeToString(
						runtime
					)} (available runtimes ${Array.from(
						hashes.keys(),
						runtimeToString
					).join(", ")})`
				);
			}
			return hashInfo;
		}
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {boolean} true, if the module has hashes for this runtime
	 */
	hasModuleHashes(module, runtime) {
		const cgm = this._getChunkGraphModule(module);
		const hashes = cgm.hashes;
		return hashes && hashes.has(runtime);
	}

	// 返回模块hash
	getModuleHash(module, runtime) {
		const cgm = this._getChunkGraphModule(module);
		const hashes = cgm.hashes;
		return this._getModuleHashInfo(module, hashes, runtime).hash;
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {string} hash
	 */
	getRenderedModuleHash(module, runtime) {
		const cgm = this._getChunkGraphModule(module);
		const hashes = cgm.hashes;
		return this._getModuleHashInfo(module, hashes, runtime).renderedHash;
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @param {string} hash the full hash
	 * @param {string} renderedHash the shortened hash for rendering
	 * @returns {void}
	 */
	setModuleHashes(module, runtime, hash, renderedHash) {
		const cgm = this._getChunkGraphModule(module);
		if (cgm.hashes === undefined) {
			cgm.hashes = new RuntimeSpecMap();
		}
		cgm.hashes.set(runtime, new ModuleHashInfo(hash, renderedHash));
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @param {Set<string>} items runtime requirements to be added (ownership of this Set is given to ChunkGraph)
	 * @returns {void}
	 */
	// 
	addModuleRuntimeRequirements(module, runtime, items) {
		const cgm = this._getChunkGraphModule(module);
		const runtimeRequirementsMap = cgm.runtimeRequirements;
		if (runtimeRequirementsMap === undefined) {
			const map = new RuntimeSpecMap();
			map.set(runtime, items);
			cgm.runtimeRequirements = map;
			return;
		}
		runtimeRequirementsMap.update(runtime, runtimeRequirements => {
			if (runtimeRequirements === undefined) {
				return items;
			} else if (runtimeRequirements.size >= items.size) {
				for (const item of items) runtimeRequirements.add(item);
				return runtimeRequirements;
			} else {
				for (const item of runtimeRequirements) items.add(item);
				return items;
			}
		});
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {Set<string>} items runtime requirements to be added (ownership of this Set is given to ChunkGraph)
	 * @returns {void}
	 */
	addChunkRuntimeRequirements(chunk, items) {
		const cgc = this._getChunkGraphChunk(chunk);
		const runtimeRequirements = cgc.runtimeRequirements;
		if (runtimeRequirements === undefined) {
			cgc.runtimeRequirements = items;
		} else if (runtimeRequirements.size >= items.size) {
			for (const item of items) runtimeRequirements.add(item);
		} else {
			for (const item of runtimeRequirements) items.add(item);
			cgc.runtimeRequirements = items;
		}
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @param {Iterable<string>} items runtime requirements to be added
	 * @returns {void}
	 */
	addTreeRuntimeRequirements(chunk, items) {
		const cgc = this._getChunkGraphChunk(chunk);
		const runtimeRequirements = cgc.runtimeRequirementsInTree;
		for (const item of items) runtimeRequirements.add(item);
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {ReadonlySet<string>} runtime requirements
	 */
	getModuleRuntimeRequirements(module, runtime) {
		const cgm = this._getChunkGraphModule(module);
		const runtimeRequirements =
			cgm.runtimeRequirements && cgm.runtimeRequirements.get(runtime);
		return runtimeRequirements === undefined ? EMPTY_SET : runtimeRequirements;
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {ReadonlySet<string>} runtime requirements
	 */
	getChunkRuntimeRequirements(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		const runtimeRequirements = cgc.runtimeRequirements;
		return runtimeRequirements === undefined ? EMPTY_SET : runtimeRequirements;
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @param {boolean} withConnections include connections
	 * @returns {string} hash
	 */
	getModuleGraphHash(module, runtime, withConnections = true) {
		const cgm = this._getChunkGraphModule(module);
		return withConnections
			? this._getModuleGraphHashWithConnections(cgm, module, runtime)
			: this._getModuleGraphHashBigInt(cgm, module, runtime).toString(16);
	}

	/**
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @param {boolean} withConnections include connections
	 * @returns {bigint} hash
	 */
	getModuleGraphHashBigInt(module, runtime, withConnections = true) {
		const cgm = this._getChunkGraphModule(module);
		return withConnections
			? BigInt(
					`0x${this._getModuleGraphHashWithConnections(cgm, module, runtime)}`
			  )
			: this._getModuleGraphHashBigInt(cgm, module, runtime);
	}

	/**
	 * @param {ChunkGraphModule} cgm the ChunkGraphModule
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {bigint} hash as big int
	 */
	_getModuleGraphHashBigInt(cgm, module, runtime) {
		if (cgm.graphHashes === undefined) {
			cgm.graphHashes = new RuntimeSpecMap();
		}
		const graphHash = cgm.graphHashes.provide(runtime, () => {
			const hash = createHash("md4");
			hash.update(`${cgm.id}`);
			hash.update(`${this.moduleGraph.isAsync(module)}`);
			this.moduleGraph.getExportsInfo(module).updateHash(hash, runtime);
			return BigInt(`0x${/** @type {string} */ (hash.digest("hex"))}`);
		});
		return graphHash;
	}

	/**
	 * @param {ChunkGraphModule} cgm the ChunkGraphModule
	 * @param {Module} module the module
	 * @param {RuntimeSpec} runtime the runtime
	 * @returns {string} hash
	 */
	_getModuleGraphHashWithConnections(cgm, module, runtime) {
		if (cgm.graphHashesWithConnections === undefined) {
			cgm.graphHashesWithConnections = new RuntimeSpecMap();
		}
		const activeStateToString = state => {
			if (state === false) return "F";
			if (state === true) return "T";
			if (state === ModuleGraphConnection.TRANSITIVE_ONLY) return "O";
			throw new Error("Not implemented active state");
		};
		const strict = module.buildMeta && module.buildMeta.strictHarmonyModule;
		return cgm.graphHashesWithConnections.provide(runtime, () => {
			const graphHash = this._getModuleGraphHashBigInt(
				cgm,
				module,
				runtime
			).toString(16);
			const connections = this.moduleGraph.getOutgoingConnections(module);
			/** @type {Set<Module>} */
			const activeNamespaceModules = new Set();
			/** @type {Map<string, Module | Set<Module>>} */
			const connectedModules = new Map();
			const processConnection = (connection, stateInfo) => {
				const module = connection.module;
				stateInfo += module.getExportsType(this.moduleGraph, strict);
				// cspell:word Tnamespace
				if (stateInfo === "Tnamespace") activeNamespaceModules.add(module);
				else {
					const oldModule = connectedModules.get(stateInfo);
					if (oldModule === undefined) {
						connectedModules.set(stateInfo, module);
					} else if (oldModule instanceof Set) {
						oldModule.add(module);
					} else if (oldModule !== module) {
						connectedModules.set(stateInfo, new Set([oldModule, module]));
					}
				}
			};
			if (runtime === undefined || typeof runtime === "string") {
				for (const connection of connections) {
					const state = connection.getActiveState(runtime);
					if (state === false) continue;
					processConnection(connection, state === true ? "T" : "O");
				}
			} else {
				// cspell:word Tnamespace
				for (const connection of connections) {
					const states = new Set();
					let stateInfo = "";
					forEachRuntime(
						runtime,
						runtime => {
							const state = connection.getActiveState(runtime);
							states.add(state);
							stateInfo += activeStateToString(state) + runtime;
						},
						true
					);
					if (states.size === 1) {
						const state = first(states);
						if (state === false) continue;
						stateInfo = activeStateToString(state);
					}
					processConnection(connection, stateInfo);
				}
			}
			// cspell:word Tnamespace
			if (activeNamespaceModules.size === 0 && connectedModules.size === 0)
				return graphHash;
			const connectedModulesInOrder =
				connectedModules.size > 1
					? Array.from(connectedModules).sort(([a], [b]) => (a < b ? -1 : 1))
					: connectedModules;
			const hash = createHash("md4");
			const addModuleToHash = module => {
				hash.update(
					this._getModuleGraphHashBigInt(
						this._getChunkGraphModule(module),
						module,
						runtime
					).toString(16)
				);
			};
			const addModulesToHash = modules => {
				let xor = ZERO_BIG_INT;
				for (const m of modules) {
					xor =
						xor ^
						this._getModuleGraphHashBigInt(
							this._getChunkGraphModule(m),
							m,
							runtime
						);
				}
				hash.update(xor.toString(16));
			};
			if (activeNamespaceModules.size === 1)
				addModuleToHash(activeNamespaceModules.values().next().value);
			else if (activeNamespaceModules.size > 1)
				addModulesToHash(activeNamespaceModules);
			for (const [stateInfo, modules] of connectedModulesInOrder) {
				hash.update(stateInfo);
				if (modules instanceof Set) {
					addModulesToHash(modules);
				} else {
					addModuleToHash(modules);
				}
			}
			hash.update(graphHash);
			return /** @type {string} */ (hash.digest("hex"));
		});
	}

	/**
	 * @param {Chunk} chunk the chunk
	 * @returns {ReadonlySet<string>} runtime requirements
	 */
	getTreeRuntimeRequirements(chunk) {
		const cgc = this._getChunkGraphChunk(chunk);
		return cgc.runtimeRequirementsInTree;
	}

	// 返回 Module 对应的 ChunkGraph
	static getChunkGraphForModule(module, deprecateMessage, deprecationCode) {
		// NOTE:
		// 这里用fn来包括 主要是API遗弃
		const fn = deprecateGetChunkGraphForModuleMap.get(deprecateMessage);
		if (fn) return fn(module);
		const newFn = util.deprecate(
			/**
			 * @param {Module} module the module
			 * @returns {ChunkGraph} the chunk graph
			 */
			module => {
				const chunkGraph = chunkGraphForModuleMap.get(module);
				if (!chunkGraph)
					throw new Error(
						deprecateMessage +
							": There was no ChunkGraph assigned to the Module for backward-compat (Use the new API)"
					);
				return chunkGraph;
			},
			deprecateMessage + ": Use new ChunkGraph API",
			deprecationCode
		);
		deprecateGetChunkGraphForModuleMap.set(deprecateMessage, newFn);
		return newFn(module);
	}

	// 缓存 Module 对应的 ChunkGraph
	static setChunkGraphForModule(module, chunkGraph) {
		chunkGraphForModuleMap.set(module, chunkGraph);
	}
	
	// 移除 Module 对应的 ChunkGraph
	static clearChunkGraphForModule(module) {
		chunkGraphForModuleMap.delete(module);
	}

	// 返回 Chunk 对应的 ChunkGraph
	static getChunkGraphForChunk(chunk, deprecateMessage, deprecationCode) {
		// 这里用fn来包括 主要是API遗弃
		const fn = deprecateGetChunkGraphForChunkMap.get(deprecateMessage);
		if (fn) return fn(chunk);
		const newFn = util.deprecate(
			/**
			 * @param {Chunk} chunk the chunk
			 * @returns {ChunkGraph} the chunk graph
			 */
			chunk => {
				const chunkGraph = chunkGraphForChunkMap.get(chunk);
				if (!chunkGraph)
					throw new Error(
						deprecateMessage +
							"There was no ChunkGraph assigned to the Chunk for backward-compat (Use the new API)"
					);
				return chunkGraph;
			},
			deprecateMessage + ": Use new ChunkGraph API",
			deprecationCode
		);
		deprecateGetChunkGraphForChunkMap.set(deprecateMessage, newFn);
		return newFn(chunk);
	}
	
	// 缓存 Chunk 对应的 ChunkGraph
	static setChunkGraphForChunk(chunk, chunkGraph) {
		chunkGraphForChunkMap.set(chunk, chunkGraph);
	}

	// 移除 Chunk 对应的 ChunkGraph
	static clearChunkGraphForChunk(chunk) {
		chunkGraphForChunkMap.delete(chunk);
	}
}

// WeakMap<Module, ChunkGraph>
const chunkGraphForModuleMap = new WeakMap();

// WeakMap<Chunk, ChunkGraph>
const chunkGraphForChunkMap = new WeakMap();

/** @type {Map<string, (module: Module) => ChunkGraph>} */
const deprecateGetChunkGraphForModuleMap = new Map();

// TODO remove in webpack 6
/** @type {Map<string, (chunk: Chunk) => ChunkGraph>} */
const deprecateGetChunkGraphForChunkMap = new Map();

module.exports = ChunkGraph;
