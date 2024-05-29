"use strict";

const DependenciesBlock = require("./DependenciesBlock");
const makeSerializable = require("./util/makeSerializable");

// 异步模块
class AsyncDependenciesBlock extends DependenciesBlock {
	constructor(groupOptions, loc, request) {
		super();
		if (typeof groupOptions === "string") {
			groupOptions = { name: groupOptions };
		} else if (!groupOptions) {
			groupOptions = { name: undefined };
		}
		this.groupOptions = groupOptions;
		// 位置信息
		this.loc = loc;
		// 模块请求路径
		this.request = request;
		// TODO: 父模块
		/** @type {DependenciesBlock} */
		this.parent = undefined;
	}

	// 返回ChunkName
	// 动态导入内敛注释中的 webpackChunkName 字段
	get chunkName() {
		return this.groupOptions.name;
	}

	// 设置ChunkName
	set chunkName(value) {
		this.groupOptions.name = value;
	}

	// 更新hash
	updateHash(hash, context) {
		const { chunkGraph } = context;
		hash.update(JSON.stringify(this.groupOptions));
		const chunkGroup = chunkGraph.getBlockChunkGroup(this);
		hash.update(chunkGroup ? chunkGroup.id : "");
		super.updateHash(hash, context);
	}

	serialize(context) {
		const { write } = context;
		write(this.groupOptions);
		write(this.loc);
		write(this.request);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.groupOptions = read();
		this.loc = read();
		this.request = read();
		super.deserialize(context);
	}
}

makeSerializable(AsyncDependenciesBlock, "webpack/lib/AsyncDependenciesBlock");

// AsyncDependencyBlock.prototype.module 属性被移除
Object.defineProperty(AsyncDependenciesBlock.prototype, "module", {
	get() {
		throw new Error(
			"module property was removed from AsyncDependenciesBlock (it's not needed)"
		);
	},
	set() {
		throw new Error(
			"module property was removed from AsyncDependenciesBlock (it's not needed)"
		);
	}
});

module.exports = AsyncDependenciesBlock;
