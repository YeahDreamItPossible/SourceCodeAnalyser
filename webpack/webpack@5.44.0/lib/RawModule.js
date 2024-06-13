"use strict";

const { OriginalSource, RawSource } = require("webpack-sources");
const Module = require("./Module");
const makeSerializable = require("./util/makeSerializable");

const TYPES = new Set(["javascript"]);

// 原始模块
class RawModule extends Module {
	constructor(source, identifier, readableIdentifier, runtimeRequirements) {
		super("javascript/dynamic", null);
		// 源代码
		this.sourceStr = source;
		// 唯一标识符
		this.identifierStr = identifier || this.sourceStr;
		// 可读的标识符
		this.readableIdentifierStr = readableIdentifier || this.identifierStr;
		// 
		this.runtimeRequirements = runtimeRequirements || null;
	}
	
	getSourceTypes() {
		return TYPES;
	}

	identifier() {
		return this.identifierStr;
	}

	/**
	 * @param {string=} type the source type for which the size should be estimated
	 * @returns {number} the estimated size of the module (must be non-zero)
	 */
	size(type) {
		return Math.max(1, this.sourceStr.length);
	}

	// 路径缩短器
	readableIdentifier(requestShortener) {
		return requestShortener.shorten(this.readableIdentifierStr);
	}

	// 
	needBuild(context, callback) {
		return callback(null, !this.buildMeta);
	}

	// 
	build(options, compilation, resolver, fs, callback) {
		this.buildMeta = {};
		this.buildInfo = {
			cacheable: true
		};
		callback();
	}

	codeGeneration(context) {
		const sources = new Map();
		if (this.useSourceMap || this.useSimpleSourceMap) {
			sources.set(
				"javascript",
				new OriginalSource(this.sourceStr, this.identifier())
			);
		} else {
			sources.set("javascript", new RawSource(this.sourceStr));
		}
		return { sources, runtimeRequirements: this.runtimeRequirements };
	}

	updateHash(hash, context) {
		hash.update(this.sourceStr);
		super.updateHash(hash, context);
	}

	serialize(context) {
		const { write } = context;

		write(this.sourceStr);
		write(this.identifierStr);
		write(this.readableIdentifierStr);
		write(this.runtimeRequirements);

		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;

		this.sourceStr = read();
		this.identifierStr = read();
		this.readableIdentifierStr = read();
		this.runtimeRequirements = read();

		super.deserialize(context);
	}
}

makeSerializable(RawModule, "webpack/lib/RawModule");

module.exports = RawModule;
