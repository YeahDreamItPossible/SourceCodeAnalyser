"use strict";

const WebpackError = require("./WebpackError");

// 块渲染错误
class ChunkRenderError extends WebpackError {
	/**
	 * Create a new ChunkRenderError
	 * @param {Chunk} chunk A chunk
	 * @param {string} file Related file
	 * @param {Error} error Original error
	 */
	constructor(chunk, file, error) {
		super();

		this.name = "ChunkRenderError";
		this.error = error;
		this.message = error.message;
		this.details = error.stack;
		this.file = file;
		this.chunk = chunk;
	}
}

module.exports = ChunkRenderError;
