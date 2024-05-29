"use strict";

// 代码生成器
class Generator {
	static byType(map) {
		return new ByTypeGenerator(map);
	}

	// 抽象方法
	// 返回代码生成器类型
	getTypes(module) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 抽象方法
	// 返回模块大小
	getSize(module, type) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 抽象方法
	// 生成代码
	generate(
		module,
		{ dependencyTemplates, runtimeTemplate, moduleGraph, type }
	) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 返回模块无法被连接时的理由
	getConcatenationBailoutReason(module, context) {
		return `Module Concatenation is not implemented for ${this.constructor.name}`;
	}

	// 更新hash
	updateHash(hash, { module, runtime }) {
		// no nothing
	}
}

class ByTypeGenerator extends Generator {
	constructor(map) {
		super();
		this.map = map;
		this._types = new Set(Object.keys(map));
	}

	// 返回代码生成器类型
	getTypes(module) {
		return this._types;
	}

	// 返回模块大小
	getSize(module, type) {
		const t = type || "javascript";
		const generator = this.map[t];
		return generator ? generator.getSize(module, t) : 0;
	}

	// 代码生成
	generate(module, generateContext) {
		const type = generateContext.type;
		const generator = this.map[type];
		if (!generator) {
			throw new Error(`Generator.byType: no generator specified for ${type}`);
		}
		return generator.generate(module, generateContext);
	}
}

module.exports = Generator;
