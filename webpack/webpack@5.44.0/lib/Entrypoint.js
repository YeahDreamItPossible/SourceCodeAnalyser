"use strict";

const ChunkGroup = require("./ChunkGroup");

/**
 * 入口点分类:
 * InitialEntrypoint(初始入口点):
 * 当 构建完成 时 首次加载 bundle 时必须要加载的块
 * AsyncEntrypint(异步入口点):
 * 当 某个块 在运行时 需要要额外异步加载的块
 */

// 入口点
// 作用:
// 当前构建的入口
class Entrypoint extends ChunkGroup {
	constructor(entryOptions, initial = true) {
		if (typeof entryOptions === "string") {
			entryOptions = { name: entryOptions };
		}
		super({
			name: entryOptions.name
		});
		// 选项
		this.options = entryOptions;
		// 运行时块
		this._runtimeChunk = undefined;
		// 入口块
		this._entrypointChunk = undefined;
		// 标识: 当前入口点是否要初始加载
		this._initial = initial;
	}

	// 返回当前 ChunkGroup 是否要初始加载
	isInitial() {
		return this._initial;
	}

	// 设置 运行时块
	setRuntimeChunk(chunk) {
		this._runtimeChunk = chunk;
	}

	// 返回 运行时块
	getRuntimeChunk() {
		if (this._runtimeChunk) return this._runtimeChunk;
		for (const parent of this.parentsIterable) {
			if (parent instanceof Entrypoint) return parent.getRuntimeChunk();
		}
		return null;
	}

	// 设置 入口块
	setEntrypointChunk(chunk) {
		this._entrypointChunk = chunk;
	}

	// 返回 入口Chunk
	getEntrypointChunk() {
		return this._entrypointChunk;
	}

	// 替换 运行时块 或 替换 入口块
	replaceChunk(oldChunk, newChunk) {
		if (this._runtimeChunk === oldChunk) this._runtimeChunk = newChunk;
		if (this._entrypointChunk === oldChunk) this._entrypointChunk = newChunk;
		return super.replaceChunk(oldChunk, newChunk);
	}
}

module.exports = Entrypoint;
