"use strict";

const makeSerializable = require("./util/makeSerializable");

// 依赖块(模块基类)
class DependenciesBlock {
	constructor() {
		// 依赖
		this.dependencies = [];
		// 当前模块中包含的子模块(异步模块)
		this.blocks = [];
	}

	// 添加异步模块
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

	// 更新hash
	updateHash(hash, context) {
		for (const dep of this.dependencies) {
			dep.updateHash(hash, context);
		}
		for (const block of this.blocks) {
			block.updateHash(hash, context);
		}
	}

	// 序列化
	serialize({ write }) {
		write(this.dependencies);
		write(this.blocks);
	}

	// 反序列化
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
