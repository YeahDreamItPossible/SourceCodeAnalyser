"use strict";

const { LogType } = require("./Logger");

// 返回 过滤函数
const filterToFunction = item => {
	if (typeof item === "string") {
		const regExp = new RegExp(
			`[\\\\/]${item.replace(
				// eslint-disable-next-line no-useless-escape
				/[-[\]{}()*+?.\\^$|]/g,
				"\\$&"
			)}([\\\\/]|$|!|\\?)`
		);
		return ident => regExp.test(ident);
	}
	if (item && typeof item === "object" && typeof item.test === "function") {
		return ident => item.test(ident);
	}
	if (typeof item === "function") {
		return item;
	}
	if (typeof item === "boolean") {
		return () => item;
	}
};

// 日志级别
const LogLevel = {
	none: 6,
	false: 6,
	error: 5,
	warn: 4,
	info: 3,
	log: 2,
	true: 2,
	verbose: 1
};

module.exports = ({ level = "info", debug = false, console }) => {
	const debugFilters =
		typeof debug === "boolean"
			? [() => debug]
			: ([])
					.concat(debug)
					.map(filterToFunction);
	const loglevel = LogLevel[`${level}`] || 0;

	const logger = (name, type, args) => {
		const labeledArgs = () => {
			if (Array.isArray(args)) {
				if (args.length > 0 && typeof args[0] === "string") {
					return [`[${name}] ${args[0]}`, ...args.slice(1)];
				} else {
					return [`[${name}]`, ...args];
				}
			} else {
				return [];
			}
		};
		const debug = debugFilters.some(f => f(name));
		switch (type) {
			case LogType.debug:
				if (!debug) return;
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				if (typeof console.debug === "function") {
					// eslint-disable-next-line node/no-unsupported-features/node-builtins
					console.debug(...labeledArgs());
				} else {
					console.log(...labeledArgs());
				}
				break;
			case LogType.log:
				if (!debug && loglevel > LogLevel.log) return;
				console.log(...labeledArgs());
				break;
			case LogType.info:
				if (!debug && loglevel > LogLevel.info) return;
				console.info(...labeledArgs());
				break;
			case LogType.warn:
				if (!debug && loglevel > LogLevel.warn) return;
				console.warn(...labeledArgs());
				break;
			case LogType.error:
				if (!debug && loglevel > LogLevel.error) return;
				console.error(...labeledArgs());
				break;
			case LogType.trace:
				if (!debug) return;
				console.trace();
				break;
			case LogType.groupCollapsed:
				if (!debug && loglevel > LogLevel.log) return;
				if (!debug && loglevel > LogLevel.verbose) {
					// eslint-disable-next-line node/no-unsupported-features/node-builtins
					if (typeof console.groupCollapsed === "function") {
						// eslint-disable-next-line node/no-unsupported-features/node-builtins
						console.groupCollapsed(...labeledArgs());
					} else {
						console.log(...labeledArgs());
					}
					break;
				}
			// falls through
			case LogType.group:
				if (!debug && loglevel > LogLevel.log) return;
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				if (typeof console.group === "function") {
					// eslint-disable-next-line node/no-unsupported-features/node-builtins
					console.group(...labeledArgs());
				} else {
					console.log(...labeledArgs());
				}
				break;
			case LogType.groupEnd:
				if (!debug && loglevel > LogLevel.log) return;
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				if (typeof console.groupEnd === "function") {
					// eslint-disable-next-line node/no-unsupported-features/node-builtins
					console.groupEnd();
				}
				break;
			case LogType.time: {
				if (!debug && loglevel > LogLevel.log) return;
				const ms = args[1] * 1000 + args[2] / 1000000;
				const msg = `[${name}] ${args[0]}: ${ms} ms`;
				if (typeof console.logTime === "function") {
					console.logTime(msg);
				} else {
					console.log(msg);
				}
				break;
			}
			case LogType.profile:
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				if (typeof console.profile === "function") {
					// eslint-disable-next-line node/no-unsupported-features/node-builtins
					console.profile(...labeledArgs());
				}
				break;
			case LogType.profileEnd:
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				if (typeof console.profileEnd === "function") {
					// eslint-disable-next-line node/no-unsupported-features/node-builtins
					console.profileEnd(...labeledArgs());
				}
				break;
			case LogType.clear:
				if (!debug && loglevel > LogLevel.log) return;
				// eslint-disable-next-line node/no-unsupported-features/node-builtins
				if (typeof console.clear === "function") {
					// eslint-disable-next-line node/no-unsupported-features/node-builtins
					console.clear();
				}
				break;
			case LogType.status:
				if (!debug && loglevel > LogLevel.info) return;
				if (typeof console.status === "function") {
					if (args.length === 0) {
						console.status();
					} else {
						console.status(...labeledArgs());
					}
				} else {
					if (args.length !== 0) {
						console.info(...labeledArgs());
					}
				}
				break;
			default:
				throw new Error(`Unexpected LogType ${type}`);
		}
	};
	return logger;
};
