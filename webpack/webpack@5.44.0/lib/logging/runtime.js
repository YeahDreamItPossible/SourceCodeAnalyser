"use strict";

const SyncBailHook = require("tapable/lib/SyncBailHook");
const { Logger } = require("./Logger");
const createConsoleLogger = require("./createConsoleLogger");

let currentDefaultLoggerOptions = {
	level: "info",
	debug: false,
	console
};
let currentDefaultLogger = createConsoleLogger(currentDefaultLoggerOptions);

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

exports.configureDefaultLogger = options => {
	Object.assign(currentDefaultLoggerOptions, options);
	currentDefaultLogger = createConsoleLogger(currentDefaultLoggerOptions);
};

exports.hooks = {
	log: new SyncBailHook(["origin", "type", "args"])
};
