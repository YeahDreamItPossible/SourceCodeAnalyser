"use strict";

const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

/** @typedef {import("../ChunkGraph")} ChunkGraph */
/** @typedef {import("../Dependency").ExportSpec} ExportSpec */
/** @typedef {import("../Dependency").ExportsSpec} ExportsSpec */
/** @typedef {import("../Dependency").UpdateHashContext} UpdateHashContext */
/** @typedef {import("../ModuleGraph")} ModuleGraph */
/** @typedef {import("../util/Hash")} Hash */

// 静态导出依赖
// TODO: 与 ExternalModule 相关
class StaticExportsDependency extends NullDependency {
	/**
	 * @param {string[] | true} exports export names
	 * @param {boolean} canMangle true, if mangling exports names is allowed
	 */
	constructor(exports, canMangle) {
		super();
		this.exports = exports;
		this.canMangle = canMangle;
	}

	get type() {
		return "static exports";
	}

	/**
	 * Returns the exported names
	 * @param {ModuleGraph} moduleGraph module graph
	 * @returns {ExportsSpec | undefined} export names
	 */
	getExports(moduleGraph) {
		return {
			exports: this.exports,
			canMangle: this.canMangle,
			dependencies: undefined
		};
	}

	serialize(context) {
		const { write } = context;
		write(this.exports);
		write(this.canMangle);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.exports = read();
		this.canMangle = read();
		super.deserialize(context);
	}
}

makeSerializable(
	StaticExportsDependency,
	"webpack/lib/dependencies/StaticExportsDependency"
);

module.exports = StaticExportsDependency;
