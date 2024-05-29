"use strict";

const { OriginalSource, RawSource } = require("webpack-sources");
const Module = require("./Module");
const makeSerializable = require("./util/makeSerializable");

const TYPES = new Set(["javascript"]);

class RawModule extends Module {
	/**
	 * @param {string} source source code
	 * @param {string} identifier unique identifier
	 * @param {string=} readableIdentifier readable identifier
	 * @param {ReadonlySet<string>=} runtimeRequirements runtime requirements needed for the source code
	 */
	constructor(source, identifier, readableIdentifier, runtimeRequirements) {
		super("javascript/dynamic", null);
		// 
		this.sourceStr = source;
		//
		this.identifierStr = identifier || this.sourceStr;
		// 
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

	/**
	 * @param {RequestShortener} requestShortener the request shortener
	 * @returns {string} a user readable identifier of the module
	 */
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
