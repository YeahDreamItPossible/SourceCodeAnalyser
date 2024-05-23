"use strict";

// 基类
class Source {
	// 返回 String 或者 Buffer形式的源代码(source code)
	source() {
		throw new Error("Abstract");
	}

	// 返回 Buffer 形式的源代码(source code)
	buffer() {
		const source = this.source();
		if (Buffer.isBuffer(source)) return source;
		return Buffer.from(source, "utf-8");
	}

	// 返回 Buffer 形式源代码(source code)的大小
	size() {
		return this.buffer().length;
	}

	// 返回 Json形式的SourceMap
	map(options) {
		return null;
	}

	// 返回 Buffer 或者 String 形式的源代码(source code) 和 Json形式的SourceMap
	sourceAndMap(options) {
		return {
			source: this.source(),
			map: this.map(options)
		};
	}

	// 更新hash值
	updateHash(hash) {
		throw new Error("Abstract");
	}
}

module.exports = Source;
