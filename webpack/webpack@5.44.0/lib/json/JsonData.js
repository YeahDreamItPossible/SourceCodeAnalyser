"use strict";

const { register } = require("../util/serialization");

// 存储 JSON 数据
class JsonData {
	constructor(data) {
		// Buffer 类型
		this._buffer = undefined;
		// String 类型
		this._data = undefined;
		if (Buffer.isBuffer(data)) {
			this._buffer = data;
		} else {
			this._data = data;
		}
	}

	get() {
		if (this._data === undefined && this._buffer !== undefined) {
			this._data = JSON.parse(this._buffer.toString());
		}
		return this._data;
	}
}

register(JsonData, "webpack/lib/json/JsonData", null, {
	serialize(obj, { write }) {
		if (obj._buffer === undefined && obj._data !== undefined) {
			obj._buffer = Buffer.from(JSON.stringify(obj._data));
		}
		write(obj._buffer);
	},
	deserialize({ read }) {
		return new JsonData(read());
	}
});

module.exports = JsonData;
