"use strict";

const SyncBailHook = require("tapable/lib/SyncBailHook");
const { Logger } = require("./Logger");
const createConsoleLogger = require("./createConsoleLogger");

// 默认日志选项
let currentDefaultLoggerOptions = {
	level: "info",
	debug: false,
	console
};
// 默认日志对象
let currentDefaultLogger = createConsoleLogger(currentDefaultLoggerOptions);

// 创建日志对象
exports.getLogger = name => {
	return new Logger(
		(type, args) => {
			if (exports.hooks.log.call(name, type, args) === undefined) {
				currentDefaultLogger(name, type, args);
			}
		},
		childName => exports.getLogger(`${name}/${childName}`)
	);
};

// 创建 自定义日志对象
exports.configureDefaultLogger = options => {
	Object.assign(currentDefaultLoggerOptions, options);
	currentDefaultLogger = createConsoleLogger(currentDefaultLoggerOptions);
};

exports.hooks = {
	// 只有当该钩子返回 undefined 时 才会日志输出
	log: new SyncBailHook(["origin", "type", "args"])
};
