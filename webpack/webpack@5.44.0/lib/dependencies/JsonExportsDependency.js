"use strict";

const makeSerializable = require("../util/makeSerializable");
const NullDependency = require("./NullDependency");

const getExportsFromData = data => {
	if (data && typeof data === "object") {
		if (Array.isArray(data)) {
			return data.map((item, idx) => {
				return {
					name: `${idx}`,
					canMangle: true,
					exports: getExportsFromData(item)
				};
			});
		} else {
			const exports = [];
			for (const key of Object.keys(data)) {
				exports.push({
					name: key,
					canMangle: true,
					exports: getExportsFromData(data[key])
				});
			}
			return exports;
		}
	}
	return undefined;
};

// JSON 文件输出依赖
class JsonExportsDependency extends NullDependency {
	constructor(exports) {
		super();
		this.exports = exports;
	}

	get type() {
		return "json exports";
	}

	getExports(moduleGraph) {
		return {
			exports: this.exports,
			dependencies: undefined
		};
	}

	updateHash(hash, context) {
		hash.update(this.exports ? JSON.stringify(this.exports) : "undefined");
	}

	serialize(context) {
		const { write } = context;
		write(this.exports);
		super.serialize(context);
	}

	deserialize(context) {
		const { read } = context;
		this.exports = read();
		super.deserialize(context);
	}
}

makeSerializable(
	JsonExportsDependency,
	"webpack/lib/dependencies/JsonExportsDependency"
);

module.exports = JsonExportsDependency;
module.exports.getExportsFromData = getExportsFromData;
