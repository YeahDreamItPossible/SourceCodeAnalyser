"use strict";

const { RawSource } = require("webpack-sources");
const OriginalSource = require("webpack-sources").OriginalSource;
const Module = require("./Module");

const TYPES = new Set(["runtime"]);

// 运行时模块
// 作用:
// 
class RuntimeModule extends Module {
	constructor(name, stage = 0) {
		super("runtime");
		// 模块运行时名
		this.name = name;
		// 
		this.stage = stage;
		// 构建元信息
		this.buildMeta = {};
		// 构建信息
		this.buildInfo = {};
		// 
		this.compilation = undefined;
		// 
		this.chunk = undefined;
		// 
		this.chunkGraph = undefined;
		// 
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

	// 是否应该隔离
	// 当 该运行时模块 需要独立作用域时
	shouldIsolate() {
		return true;
	}
}

/**
 * Runtime modules without any dependencies to other runtime modules
 */
// 运行时模块阶段
// 当前运行时模块 不依赖 其他运行时模块
RuntimeModule.STAGE_NORMAL = 0;
// 当前运行时模块 对 其他运行时模块 有简单依赖关系
RuntimeModule.STAGE_BASIC = 5;
// 当前运行时模块 附加到 其他运行时模块
RuntimeModule.STAGE_ATTACH = 10;
// 当前运行时模块 将会在引导程序上 触发操作
RuntimeModule.STAGE_TRIGGER = 20;

module.exports = RuntimeModule;
