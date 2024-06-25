"use strict";

const WebpackError = require("./WebpackError");
const makeSerializable = require("./util/makeSerializable");

// 
class CommentCompilationWarning extends WebpackError {
	constructor(message, loc) {
		super(message);

		this.name = "CommentCompilationWarning";

		this.loc = loc;
	}
}

makeSerializable(
	CommentCompilationWarning,
	"webpack/lib/CommentCompilationWarning"
);

module.exports = CommentCompilationWarning;
