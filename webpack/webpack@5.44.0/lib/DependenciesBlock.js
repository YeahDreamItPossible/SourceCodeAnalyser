"use strict";

const makeSerializable = require("./util/makeSerializable");

/** @typedef {import("./AsyncDependenciesBlock")} AsyncDependenciesBlock */
/** @typedef {import("./ChunkGraph")} ChunkGraph */
/** @typedef {import("./ChunkGroup")} ChunkGroup */
/** @typedef {import("./Dependency")} Dependency */
/** @typedef {import("./Dependency").UpdateHashContext} UpdateHashContext */
/** @typedef {import("./util/Hash")} Hash */

/** @typedef {(d: Dependency) => boolean} DependencyFilterFunction */

class DependenciesBlock {
	constructor() {
		// 依赖
		this.dependencies = [];
		// 分组块
		/** @type {AsyncDependenciesBlock[]} */
		this.blocks = [];
	}

	// 添加块
	addBlock(block) {
		this.blocks.push(block);
		block.parent = this;
	}

	// 添加依赖
	addDependency(dependency) {
		this.dependencies.push(dependency);
	}

	// 移除依赖
	removeDependency(dependency) {
		const idx = this.dependencies.indexOf(dependency);
		if (idx >= 0) {
			this.dependencies.splice(idx, 1);
		}
	}

	// 清除所有的依赖和块
	clearDependenciesAndBlocks() {
		this.dependencies.length = 0;
		this.blocks.length = 0;
	}

	/**
	 * @param {Hash} hash the hash used to track dependencies
	 * @param {UpdateHashContext} context context
	 * @returns {void}
	 */
	updateHash(hash, context) {
		for (const dep of this.dependencies) {
			dep.updateHash(hash, context);
		}
		for (const block of this.blocks) {
			block.updateHash(hash, context);
		}
	}

	serialize({ write }) {
		write(this.dependencies);
		write(this.blocks);
	}

	deserialize({ read }) {
		this.dependencies = read();
		this.blocks = read();
		for (const block of this.blocks) {
			block.parent = this;
		}
	}
}

makeSerializable(DependenciesBlock, "webpack/lib/DependenciesBlock");

module.exports = DependenciesBlock;
