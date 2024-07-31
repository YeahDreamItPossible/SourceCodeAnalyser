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

// 返回 排序顺序 作为索引
const sortOrigin = (a, b) => {
	const aIdent = a.module ? a.module.identifier() : "";
	const bIdent = b.module ? b.module.identifier() : "";
	if (aIdent < bIdent) return -1;
	if (aIdent > bIdent) return 1;
	return compareLocations(a.loc, b.loc);
};

/**
 * 块组分类:
 * 
 */

// 块组
// 作用:
// 用来对 Chunk 的使用描述 和 逻辑分组
class ChunkGroup {
	constructor(options) {
		// 格式化块组选项
		if (typeof options === "string") {
			options = { name: options };
		} else if (!options) {
			options = { name: undefined };
		}
		// 当前块组 的debugId(唯一标识符)
		this.groupDebugId = debugId++;
		// 当前块组 选项
		this.options = options;

		// 当前块组嵌套关系
		// 当前块组 包含的 子块组
		// 与 Webpack.options.Entry.dependOn 相关
		// Set<ChunkGroup>
		this._children = new SortableSet(undefined, sortById);
		// 当前块组 包含的 父块组
		// 与 Webpack.options.Entry.dependOn 相关
		// Set<ChunkGroup>
		this._parents = new SortableSet(undefined, sortById);
		// 当前块组 包含的 异步块组
		// Set<ChunkGroup>
		this._asyncEntrypoints = new SortableSet(undefined, sortById);

		// 当前块组 中包含的 异步依赖块(异步模块)
		// Set<AsyncDependenciesBlock>
		this._blocks = new SortableSet();
		// 当前块组 包含的块
		// Array<Chunk>
		this.chunks = [];
		// 当前块组 的来源信息
		// 存储着 模块、模块请求路径、位置信息 
		// Array<{module, dependency, loc}>
		this.origins = [];

		// 当前模块 以及 当前模块被引用时对应的模块图中的嵌套
		// 模块对应的索引
		// 自上而下的索引: 构建的 ModuleGraph 中从根节点开始 当前模块所在的层级 
		// Map<Module, number>
		this._modulePreOrderIndices = new Map();
		// 自下而上的索引: 构建的 ModuleGraph 中从叶子节点开始 当前模块所在的层级 
		// Map<Module, number>
		this._modulePostOrderIndices = new Map();

		// 排序
		this.index = undefined;
	}

	// 合并 块组选项
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

	// 返回当前块组名
	get name() {
		return this.options.name;
	}

	// 设置当前块组名
	set name(value) {
		this.options.name = value;
	}

	// 返回 debugId
	get debugId() {
		// 所有 chunk.debugId 拼接
		return Array.from(this.chunks, x => x.debugId).join("+");
	}

	// 返回当前块组Id
	get id() {
		// 所有 chunk.id 拼接
		return Array.from(this.chunks, x => x.id).join("+");
	}

	// 向 当前块组 的队首添加 块 并返回 是否添加成功
	// 如果这个块 存在 则更新该块
	unshiftChunk(chunk) {
		// 当前块组中 是否已经存在某个块
		const oldIdx = this.chunks.indexOf(chunk);
		// 如果当前块组中 已经存在某个块 则更新 这个块 
		// 否则 则向当前块组 的首部添加 这个块
		if (oldIdx > 0) {
			this.chunks.splice(oldIdx, 1);
			this.chunks.unshift(chunk);
		} else if (oldIdx < 0) {
			this.chunks.unshift(chunk);
			return true;
		}
		return false;
	}

	// 在 某个块 前 插入 新块 并返回是否插入成功
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

	// 向 当前块组 的队尾添加 块
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

	// 在 当前块组 中 替换掉 某个块
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

	// 向 当前块组 中 移除 某个块
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

	// 返回 当前块组 是否要初始加载
	isInitial() {
		return false;
	}

	// 添加 子块组 并返回 是否添加成功
	addChild(group) {
		const size = this._children.size;
		this._children.add(group);
		return size !== this._children.size;
	}

	// 以数组形式返回所有的 子块组
	getChildren() {
		return this._children.getFromCache(getArray);
	}

	// 返回所有的 子块组数量
	getNumberOfChildren() {
		return this._children.size;
	}

	// 返回所有的 子块组
	get childrenIterable() {
		return this._children;
	}

	// 移除 某个子块组
	removeChild(group) {
		if (!this._children.has(group)) {
			return false;
		}

		this._children.delete(group);
		group.removeParent(this);
		return true;
	}

	// 添加 父块组 并返回 是否添加成功
	addParent(parentChunk) {
		if (!this._parents.has(parentChunk)) {
			this._parents.add(parentChunk);
			return true;
		}
		return false;
	}

	// 以数组形式返回所有的 父块组
	getParents() {
		return this._parents.getFromCache(getArray);
	}

	// 返回所有的 父块组的数量
	getNumberOfParents() {
		return this._parents.size;
	}

	// 返回是否存在 某个父块组
	hasParent(parent) {
		return this._parents.has(parent);
	}

	// 返回所有的 父块组
	get parentsIterable() {
		return this._parents;
	}

	// 移除 某个父块组 并返回 是否移除成功
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

	// 以 数组 的形式返回当前块组中包含的 异步模块
	getBlocks() {
		return this._blocks.getFromCache(getArray);
	}

	// 返回当前块组中包含的 异步模块 的数量
	getNumberOfBlocks() {
		return this._blocks.size;
	}

	// 返回当前块组中是否包含某个异步模块
	hasBlock(block) {
		return this._blocks.has(block);
	}

	// 返回当前块组中包含的 异步模块
	get blocksIterable() {
		return this._blocks;
	}

	// 添加 异步依赖块 并返回是否添加成功
	addBlock(block) {
		if (!this._blocks.has(block)) {
			this._blocks.add(block);
			return true;
		}
		return false;
	}

	// 添加 当前块组 的来源信息
	addOrigin(module, loc, request) {
		this.origins.push({
			module, // 模块
			loc,    // 位置信息
			request // 模块请求路径
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

	// 解除 当前块组 的嵌套关系 以及清除 当前块组 中包含的所有块 
	remove() {
		// 解除 当前块组 与 当前块组中父块组 的嵌套关系
		for (const parentChunkGroup of this._parents) {
			// 将 当前块组 从 其父块组中 移除
			parentChunkGroup._children.delete(this);

			// cleanup "sub chunks"
			// 绑定 当前块组 中某个 子块组 与 当前块组 中某个 父块组 的关联关系
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

		// 解除 当前块组 与 当前块组中子块组 的嵌套关系
		/**
		 * we need to iterate again over the children
		 * to remove this from the child's parents.
		 * This can not be done in the above loop
		 * as it is not guaranteed that `this._parents` contains anything.
		 */
		for (const chunkGroup of this._children) {
			// 将 当前块组 从 其子块组中 移除
			// remove this as parent of every "sub chunk"
			chunkGroup._parents.delete(this);
		}

		// 移除 当前块组 中包含的所有 块
		for (const chunk of this.chunks) {
			chunk.removeGroup(this);
		}
	}

	// 排序
	sortItems() {
		this.origins.sort(sortOrigin);
	}

	// 比较 两个块组 并返回 0 | 1 | -1
	compareTo(chunkGraph, otherGroup) {
		// 先比较 两个块组 包含的块的数量多少
		if (this.chunks.length > otherGroup.chunks.length) return -1;
		if (this.chunks.length < otherGroup.chunks.length) return 1;
		// 
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
	// TODO:
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

	// 设置 当前块组 中包含的 模块 及其对应的 自上而下的索引
	// 自上而下的索引: 构建的 ModuleGraph 中当前模块所在的层级 
	setModulePreOrderIndex(module, index) {
		this._modulePreOrderIndices.set(module, index);
	}

	// 返回 当前块组 中包含的 模块 及其对应的 自上而下的索引
	getModulePreOrderIndex(module) {
		return this._modulePreOrderIndices.get(module);
	}

	// 设置 当前块组 中包含的 模块 及其对应的 自上而下的索引
	// // 自下而上的索引: 构建的 ModuleGraph 中从叶子节点开始 当前模块所在的层级
	setModulePostOrderIndex(module, index) {
		this._modulePostOrderIndices.set(module, index);
	}

	// 返回 当前块组 中包含的 模块 及其对应的 自下而上的索引
	getModulePostOrderIndex(module) {
		return this._modulePostOrderIndices.get(module);
	}

	// 检查约束(当前块组的父块组、子块组中其他块组是否包含当前块组)
	checkConstraints() {
		const chunk = this;
		// 检查 当前块组 中的子块组 中的其他块组 是否包含 当前块组
		for (const child of chunk._children) {
			if (!child._parents.has(chunk)) {
				throw new Error(
					`checkConstraints: child missing parent ${chunk.debugId} -> ${child.debugId}`
				);
			}
		}
		// 检查 当前块组 中的父块组 中的其他块组 是否包含 当前块组
		for (const parentChunk of chunk._parents) {
			if (!parentChunk._children.has(chunk)) {
				throw new Error(
					`checkConstraints: parent missing child ${parentChunk.debugId} <- ${chunk.debugId}`
				);
			}
		}
	}
}

// ChunkGroup.prototype.getModuleIndex 已被 ChunkGroup.prototype.getModulePreOrderIndex 替代
ChunkGroup.prototype.getModuleIndex = util.deprecate(
	ChunkGroup.prototype.getModulePreOrderIndex,
	"ChunkGroup.getModuleIndex was renamed to getModulePreOrderIndex",
	"DEP_WEBPACK_CHUNK_GROUP_GET_MODULE_INDEX"
);
// ChunkGroup.prototype.getModuleIndex2 已被 ChunkGroup.prototype.getModulePostOrderIndex 替代
ChunkGroup.prototype.getModuleIndex2 = util.deprecate(
	ChunkGroup.prototype.getModulePostOrderIndex,
	"ChunkGroup.getModuleIndex2 was renamed to getModulePostOrderIndex",
	"DEP_WEBPACK_CHUNK_GROUP_GET_MODULE_INDEX_2"
);

module.exports = ChunkGroup;
