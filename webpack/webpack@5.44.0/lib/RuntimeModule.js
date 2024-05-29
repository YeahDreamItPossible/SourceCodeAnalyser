/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const { RawSource } = require("webpack-sources");
const OriginalSource = require("webpack-sources").OriginalSource;
const Module = require("./Module");

/** @typedef {import("webpack-sources").Source} Source */
/** @typedef {import("../declarations/WebpackOptions").WebpackOptionsNormalized} WebpackOptions */
/** @typedef {import("./Chunk")} Chunk */
/** @typedef {import("./ChunkGraph")} ChunkGraph */
/** @typedef {import("./Compilation")} Compilation */
/** @typedef {import("./Dependency").UpdateHashContext} UpdateHashContext */
/** @typedef {import("./Module").CodeGenerationContext} CodeGenerationContext */
/** @typedef {import("./Module").CodeGenerationResult} CodeGenerationResult */
/** @typedef {import("./Module").NeedBuildContext} NeedBuildContext */
/** @typedef {import("./RequestShortener")} RequestShortener */
/** @typedef {import("./ResolverFactory").ResolverWithOptions} ResolverWithOptions */
/** @typedef {import("./WebpackError")} WebpackError */
/** @typedef {import("./util/Hash")} Hash */
/** @typedef {import("./util/fs").InputFileSystem} InputFileSystem */

const TYPES = new Set(["runtime"]);

class RuntimeModule extends Module {
	/**
	 * @param {string} name a readable name
	 * @param {number=} stage an optional stage
	 */
	constructor(name, stage = 0) {
		super("runtime");
		// 
		this.name = name;
		this.stage = stage;
		this.buildMeta = {};
		this.buildInfo = {};
		/** @type {Compilation} */
		this.compilation = undefined;
		/** @type {Chunk} */
		this.chunk = undefined;
		/** @type {ChunkGraph} */
		this.chunkGraph = undefined;
		this.fullHash = false;
		// 缓存的生成的代码
		this._cachedGeneratedCode = undefined;
	}

	// 绑定 this.compilation this.chunk this.chunkGraph
	attach(compilation, chunk, chunkGraph = compilation.chunkGraph) {
		this.compilation = compilation;
		this.chunk = chunk;
		this.chunkGraph = chunkGraph;
	}

	// 返回 模块唯一标识符
	identifier() {
		return `webpack/runtime/${this.name}`;
	}

	/**
	 * @param {RequestShortener} requestShortener the request shortener
	 * @returns {string} a user readable identifier of the module
	 */
	// 返回 模块唯一标识符
	readableIdentifier(requestShortener) {
		return `webpack/runtime/${this.name}`;
	}

	// 是否需要构建
	needBuild(context, callback) {
		return callback(null, false);
	}

	// 构建
	build(options, compilation, resolver, fs, callback) {
		// do nothing
		// should not be called as runtime modules are added later to the compilation
		callback();
	}

	// 更新hash
	updateHash(hash, context) {
		hash.update(this.name);
		hash.update(`${this.stage}`);
		try {
			if (this.fullHash) {
				// Do not use getGeneratedCode here, because i. e. compilation hash might be not
				// ready at this point. We will cache it later instead.
				hash.update(this.generate());
			} else {
				hash.update(this.getGeneratedCode());
			}
		} catch (err) {
			hash.update(err.message);
		}
		super.updateHash(hash, context);
	}

	// 返回 类型
	getSourceTypes() {
		return TYPES;
	}

	// 代码生成
	codeGeneration(context) {
		const sources = new Map();
		const generatedCode = this.getGeneratedCode();
		if (generatedCode) {
			sources.set(
				"runtime",
				this.useSourceMap || this.useSimpleSourceMap
					? new OriginalSource(generatedCode, this.identifier())
					: new RawSource(generatedCode)
			);
		}
		return {
			sources,
			runtimeRequirements: null
		};
	}

	// 返回 生成后代码大小
	size(type) {
		try {
			const source = this.getGeneratedCode();
			return source ? source.length : 0;
		} catch (e) {
			return 0;
		}
	}

	// 生成代码
	// 抽象方法
	generate() {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}

	// 返回 生成的代码
	getGeneratedCode() {
		if (this._cachedGeneratedCode) {
			return this._cachedGeneratedCode;
		}
		return (this._cachedGeneratedCode = this.generate());
	}

	/**
	 * @returns {boolean} true, if the runtime module should get it's own scope
	 */
	shouldIsolate() {
		return true;
	}
}

/**
 * Runtime modules without any dependencies to other runtime modules
 */
RuntimeModule.STAGE_NORMAL = 0;

/**
 * Runtime modules with simple dependencies on other runtime modules
 */
RuntimeModule.STAGE_BASIC = 5;

/**
 * Runtime modules which attach to handlers of other runtime modules
 */
RuntimeModule.STAGE_ATTACH = 10;

/**
 * Runtime modules which trigger actions on bootstrap
 */
RuntimeModule.STAGE_TRIGGER = 20;

module.exports = RuntimeModule;
