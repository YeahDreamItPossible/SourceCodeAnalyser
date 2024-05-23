"use strict";

const streamChunksOfRawSource = require("./helpers/streamChunksOfRawSource");
const Source = require("./Source");

// 没有SourceMap的源代码
class RawSource extends Source {
	constructor(value, convertToString = false) {
		super();
		const isBuffer = Buffer.isBuffer(value);
		if (!isBuffer && typeof value !== "string") {
			throw new TypeError("argument 'value' must be either string of Buffer");
		}
		// 标识: 是否是Buffer类型
		this._valueIsBuffer = !convertToString && isBuffer;
		// 
		this._value = convertToString && isBuffer ? undefined : value;
		// Buffer类型的源代码
		this._valueAsBuffer = isBuffer ? value : undefined;
		// String类型的源代码
		this._valueAsString = isBuffer ? undefined : value;
	}

	// 断言: 当前源代码是否是Buffer类型
	isBuffer() {
		return this._valueIsBuffer;
	}

	// 返回 String 或者 Buffer形式的源代码(source code)
	source() {
		if (this._value === undefined) {
			this._value = this._valueAsBuffer.toString("utf-8");
		}
		return this._value;
	}

	// 返回 Buffer 形式的源代码(source code)
	buffer() {
		if (this._valueAsBuffer === undefined) {
			this._valueAsBuffer = Buffer.from(this._value, "utf-8");
		}
		return this._valueAsBuffer;
	}

	// 该类不返回SourceMap
	map(options) {
		return null;
	}

	/**
	 * @param {object} options options
	 * @param {function(string, number, number, number, number, number, number): void} onChunk called for each chunk of code
	 * @param {function(number, string, string)} onSource called for each source
	 * @param {function(number, string)} onName called for each name
	 * @returns {void}
	 */
	streamChunks(options, onChunk, onSource, onName) {
		if (this._value === undefined) {
			this._value = Buffer.from(this._valueAsBuffer, "utf-8");
		}
		if (this._valueAsString === undefined) {
			this._valueAsString =
				typeof this._value === "string"
					? this._value
					: this._value.toString("utf-8");
		}
		return streamChunksOfRawSource(
			this._valueAsString,
			onChunk,
			onSource,
			onName,
			!!(options && options.finalSource)
		);
	}

	// 更新hash值
	updateHash(hash) {
		if (this._valueAsBuffer === undefined) {
			this._valueAsBuffer = Buffer.from(this._value, "utf-8");
		}
		hash.update("RawSource");
		hash.update(this._valueAsBuffer);
	}
}

module.exports = RawSource;
