"use strict";

const util = require("util");
const SortableSet = require("./util/SortableSet");
const {
	compareLocations,
	compareChunks,
	compareIterables
} = require("./util/comparators");

let debugId = 5000;

// 将 set 转换成 array
const getArray = set => Array.from(set);

// 排序(通过比较 id 属性) 返回 0 | 1 | -1
const sortById = (a, b) => {
	if (a.id < b.id) return -1;
	if (b.id < a.id) return 1;
	return 0;
};

/**
 * @param {OriginRecord} a the first comparator in sort
 * @param {OriginRecord} b the second comparator in sort
 * @returns {1|-1|0} returns sorting order as index
 */
const sortOrigin = (a, b) => {
	const aIdent = a.module ? a.module.identifier() : "";
	const bIdent = b.module ? b.module.identifier() : "";
	if (aIdent < bIdent) return -1;
	if (aIdent > bIdent) return 1;
	return compareLocations(a.loc, b.loc);
};

// 快组:
// 作用:
// 用来对 Chunk 的使用描述 和 逻辑分组
class ChunkGroup {
	constructor(options) {
		if (typeof options === "string") {
			options = { name: options };
		} else if (!options) {
			options = { name: undefined };
		}
		// 当前 块组 的debugId(唯一标识符)
		this.groupDebugId = debugId++;
		// 当前 块组 选项
		this.options = options;

		// ChunkGroup 嵌套关系
		// 当前 块组 包含的 子块组(与 Webpack.options.Entry.dependOn 相关)
		// Set<ChunkGroup>
		this._children = new SortableSet(undefined, sortById);
		// 当前 块组 包含的 父块组(与 Webpack.options.Entry.dependOn 相关)
		// Set<ChunkGroup>
		this._parents = new SortableSet(undefined, sortById);
		// 当前 块组 包含的 异步块组
		// Set<ChunkGroup>
		this._asyncEntrypoints = new SortableSet(undefined, sortById);

		// Set<>
		this._blocks = new SortableSet();
		// 当前 块组 包含的块
		// Array<Chunk>
		this.chunks = [];
		// chunkGroup 的起源
		// 存放模块和依赖和位置信息 Array<{module, dependency, loc}>
		this.origins = [];

		// 模块对应的索引
		// 自上而下的索引
		// Map<Module, number>
		this._modulePreOrderIndices = new Map();
		// 自下而上的索引
		// Map<Module, number>
		this._modulePostOrderIndices = new Map();

		// 排序
		this.index = undefined;
	}

	// 添加 块组 选项
	addOptions(options) {
		for (const key of Object.keys(options)) {
			// 当前 key 不存在
			if (this.options[key] === undefined) {
				this.options[key] = options[key];
			} 
			else if (this.options[key] !== options[key]) {
				if (key.endsWith("Order")) {
					this.options[key] = Math.max(this.options[key], options[key]);
				} else {
					throw new Error(
						`ChunkGroup.addOptions: No option merge strategy for ${key}`
					);
				}
			}
		}
	}

	// 返回当前chunkGroup.name
	get name() {
		return this.options.name;
	}

	// 设置当前chunkGroup.name
	set name(value) {
		this.options.name = value;
	}

	// 返回 debugId(所有 chunk.debugId 拼接)
	get debugId() {
		return Array.from(this.chunks, x => x.debugId).join("+");
	}

	// 返回 id(所有 chunk.id 拼接)
	get id() {
		return Array.from(this.chunks, x => x.id).join("+");
	}

	// 向当前 块组 的首部添加 块 并返回 是否添加成功
	// 如果该 chunk 存在 则更新该 chunk
	unshiftChunk(chunk) {
		const oldIdx = this.chunks.indexOf(chunk);
		if (oldIdx > 0) {
			this.chunks.splice(oldIdx, 1);
			this.chunks.unshift(chunk);
		} else if (oldIdx < 0) {
			this.chunks.unshift(chunk);
			return true;
		}
		return false;
	}

	// 在 某个Chunk 前 插入 新Chunk 并返回是否插入成功
	insertChunk(chunk, before) {
		const oldIdx = this.chunks.indexOf(chunk);
		const idx = this.chunks.indexOf(before);
		if (idx < 0) {
			throw new Error("before chunk not found");
		}
		if (oldIdx >= 0 && oldIdx > idx) {
			this.chunks.splice(oldIdx, 1);
			this.chunks.splice(idx, 0, chunk);
		} else if (oldIdx < 0) {
			this.chunks.splice(idx, 0, chunk);
			return true;
		}
		return false;
	}

	// 向当前 块组 添加 块
	// 当 添加成功 时 返回 true
	// 当 添加失败 时 返回 false
	pushChunk(chunk) {
		const oldIdx = this.chunks.indexOf(chunk);
		if (oldIdx >= 0) {
			return false;
		}
		this.chunks.push(chunk);
		return true;
	}

	// 在当前 块组 中 替换掉 某个块
	// 当 替换成功 时 返回 true
	// 当 替换失败 时 返回 false
	replaceChunk(oldChunk, newChunk) {
		const oldIdx = this.chunks.indexOf(oldChunk);
		if (oldIdx < 0) return false;
		const newIdx = this.chunks.indexOf(newChunk);
		if (newIdx < 0) {
			this.chunks[oldIdx] = newChunk;
			return true;
		}
		if (newIdx < oldIdx) {
			this.chunks.splice(oldIdx, 1);
			return true;
		} else if (newIdx !== oldIdx) {
			this.chunks[oldIdx] = newChunk;
			this.chunks.splice(newIdx, 1);
			return true;
		}
	}

	// 向当前 块组 中 移除 某个块
	// 当 移除成功 时 返回 true
	// 移除失败时 返回 false
	removeChunk(chunk) {
		const idx = this.chunks.indexOf(chunk);
		if (idx >= 0) {
			this.chunks.splice(idx, 1);
			return true;
		}
		return false;
	}

	// 返回当前 ChunkGroup 是否要初始加载
	isInitial() {
		return false;
	}

	// 添加 子ChunkGroup 并返回 是否添加成功
	addChild(group) {
		const size = this._children.size;
		this._children.add(group);
		return size !== this._children.size;
	}

	// 以数组形式返回所有的 子ChunkGroup
	getChildren() {
		return this._children.getFromCache(getArray);
	}

	// 返回所有的 子ChunkGroup数量
	getNumberOfChildren() {
		return this._children.size;
	}

	// 返回所有的 子ChunkGroup
	get childrenIterable() {
		return this._children;
	}

	// 移除 某个子ChunkGroup
	removeChild(group) {
		if (!this._children.has(group)) {
			return false;
		}

		this._children.delete(group);
		group.removeParent(this);
		return true;
	}

	// 添加 父ChunkGroup 并返回 是否添加成功
	addParent(parentChunk) {
		if (!this._parents.has(parentChunk)) {
			this._parents.add(parentChunk);
			return true;
		}
		return false;
	}

	// 以数组形式返回所有的 父ChunkGroup
	getParents() {
		return this._parents.getFromCache(getArray);
	}

	// 返回所有的 父ChunkGroup的数量
	getNumberOfParents() {
		return this._parents.size;
	}

	// 返回是否存在某个父ChunkGroup
	hasParent(parent) {
		return this._parents.has(parent);
	}

	// 返回所有的 父ChunkGroup
	get parentsIterable() {
		return this._parents;
	}

	// 移除 某个父ChunkGroup 并返回 是否移除成功
	removeParent(chunkGroup) {
		if (this._parents.delete(chunkGroup)) {
			chunkGroup.removeChild(this);
			return true;
		}
		return false;
	}

	// 添加 异步入口点 并返回 是否添加成功
	addAsyncEntrypoint(entrypoint) {
		const size = this._asyncEntrypoints.size;
		this._asyncEntrypoints.add(entrypoint);
		return size !== this._asyncEntrypoints.size;
	}

	// 返回所有的 异步入口点
	get asyncEntrypointsIterable() {
		return this._asyncEntrypoints;
	}

	/**
	 * @returns {Array} an array containing the blocks
	 */
	getBlocks() {
		return this._blocks.getFromCache(getArray);
	}

	getNumberOfBlocks() {
		return this._blocks.size;
	}

	hasBlock(block) {
		return this._blocks.has(block);
	}

	/**
	 * @returns {Iterable<AsyncDependenciesBlock>} blocks
	 */
	get blocksIterable() {
		return this._blocks;
	}

	/**
	 * @param {AsyncDependenciesBlock} block a block
	 * @returns {boolean} false, if block was already added
	 */
	addBlock(block) {
		if (!this._blocks.has(block)) {
			this._blocks.add(block);
			return true;
		}
		return false;
	}

	/**
	 * @param {Module} module origin module
	 * @param {DependencyLocation} loc location of the reference in the origin module
	 * @param {string} request request name of the reference
	 * @returns {void}
	 */
	// 添加 
	addOrigin(module, loc, request) {
		this.origins.push({
			module,
			loc,
			request
		});
	}

	// 返回 当前块组 包含的 所有块 的 输出文件名 
	getFiles() {
		const files = new Set();

		for (const chunk of this.chunks) {
			for (const file of chunk.files) {
				files.add(file);
			}
		}

		return Array.from(files);
	}

	// 解除 当前块组 与 父块组 及 子块组 及 块 的关联关系
	remove() {
		// cleanup parents
		for (const parentChunkGroup of this._parents) {
			// remove this chunk from its parents
			parentChunkGroup._children.delete(this);

			// cleanup "sub chunks"
			for (const chunkGroup of this._children) {
				/**
				 * remove this chunk as "intermediary" and connect
				 * it "sub chunks" and parents directly
				 */
				// add parent to each "sub chunk"
				chunkGroup.addParent(parentChunkGroup);
				// add "sub chunk" to parent
				parentChunkGroup.addChild(chunkGroup);
			}
		}

		/**
		 * we need to iterate again over the children
		 * to remove this from the child's parents.
		 * This can not be done in the above loop
		 * as it is not guaranteed that `this._parents` contains anything.
		 */
		for (const chunkGroup of this._children) {
			// remove this as parent of every "sub chunk"
			chunkGroup._parents.delete(this);
		}

		// 移除所有的块
		for (const chunk of this.chunks) {
			chunk.removeGroup(this);
		}
	}

	// 
	sortItems() {
		this.origins.sort(sortOrigin);
	}

	/**
	 * Sorting predicate which allows current ChunkGroup to be compared against another.
	 * Sorting values are based off of number of chunks in ChunkGroup.
	 *
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @param {ChunkGroup} otherGroup the chunkGroup to compare this against
	 * @returns {-1|0|1} sort position for comparison
	 */
	compareTo(chunkGraph, otherGroup) {
		if (this.chunks.length > otherGroup.chunks.length) return -1;
		if (this.chunks.length < otherGroup.chunks.length) return 1;
		return compareIterables(compareChunks(chunkGraph))(
			this.chunks,
			otherGroup.chunks
		);
	}

	/**
	 * @param {ModuleGraph} moduleGraph the module graph
	 * @param {ChunkGraph} chunkGraph the chunk graph
	 * @returns {Record<string, ChunkGroup[]>} mapping from children type to ordered list of ChunkGroups
	 */
	getChildrenByOrders(moduleGraph, chunkGraph) {
		/** @type {Map<string, {order: number, group: ChunkGroup}[]>} */
		const lists = new Map();
		for (const childGroup of this._children) {
			for (const key of Object.keys(childGroup.options)) {
				if (key.endsWith("Order")) {
					const name = key.substr(0, key.length - "Order".length);
					let list = lists.get(name);
					if (list === undefined) {
						lists.set(name, (list = []));
					}
					list.push({
						order: childGroup.options[key],
						group: childGroup
					});
				}
			}
		}
		/** @type {Record<string, ChunkGroup[]>} */
		const result = Object.create(null);
		for (const [name, list] of lists) {
			list.sort((a, b) => {
				const cmp = b.order - a.order;
				if (cmp !== 0) return cmp;
				return a.group.compareTo(chunkGraph, b.group);
			});
			result[name] = list.map(i => i.group);
		}
		return result;
	}

	/**
	 * Sets the top-down index of a module in this ChunkGroup
	 * @param {Module} module module for which the index should be set
	 * @param {number} index the index of the module
	 * @returns {void}
	 */
	setModulePreOrderIndex(module, index) {
		this._modulePreOrderIndices.set(module, index);
	}

	/**
	 * Gets the top-down index of a module in this ChunkGroup
	 * @param {Module} module the module
	 * @returns {number} index
	 */
	// 
	getModulePreOrderIndex(module) {
		return this._modulePreOrderIndices.get(module);
	}

	/**
	 * Sets the bottom-up index of a module in this ChunkGroup
	 * @param {Module} module module for which the index should be set
	 * @param {number} index the index of the module
	 * @returns {void}
	 */
	setModulePostOrderIndex(module, index) {
		this._modulePostOrderIndices.set(module, index);
	}

	/**
	 * Gets the bottom-up index of a module in this ChunkGroup
	 * @param {Module} module the module
	 * @returns {number} index
	 */
	getModulePostOrderIndex(module) {
		return this._modulePostOrderIndices.get(module);
	}

	/* istanbul ignore next */
	checkConstraints() {
		const chunk = this;
		for (const child of chunk._children) {
			if (!child._parents.has(chunk)) {
				throw new Error(
					`checkConstraints: child missing parent ${chunk.debugId} -> ${child.debugId}`
				);
			}
		}
		for (const parentChunk of chunk._parents) {
			if (!parentChunk._children.has(chunk)) {
				throw new Error(
					`checkConstraints: parent missing child ${parentChunk.debugId} <- ${chunk.debugId}`
				);
			}
		}
	}
}

// chunkGroup.prototype.getModuleIndex 已被 chunkGroup.prototype.getModulePreOrderIndex 替代
ChunkGroup.prototype.getModuleIndex = util.deprecate(
	ChunkGroup.prototype.getModulePreOrderIndex,
	"ChunkGroup.getModuleIndex was renamed to getModulePreOrderIndex",
	"DEP_WEBPACK_CHUNK_GROUP_GET_MODULE_INDEX"
);
// chunkGroup.prototype.getModuleIndex2 已被 chunkGroup.prototype.getModulePostOrderIndex 替代
ChunkGroup.prototype.getModuleIndex2 = util.deprecate(
	ChunkGroup.prototype.getModulePostOrderIndex,
	"ChunkGroup.getModuleIndex2 was renamed to getModulePostOrderIndex",
	"DEP_WEBPACK_CHUNK_GROUP_GET_MODULE_INDEX_2"
);

module.exports = ChunkGroup;
