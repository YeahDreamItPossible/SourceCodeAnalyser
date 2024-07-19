"use strict";

const { LogType } = require("./Logger");

// 返回 过滤函数
// 作用: 将 不同类型的值标准化后 返回过滤函数
const filterToFunction = item => {
	// 正则匹配
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
	// 对象形式
	if (item && typeof item === "object" && typeof item.test === "function") {
		return ident => item.test(ident);
	}
	if (typeof item === "function") {
		return item;
	}
	// 默认 Boolean
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

// 创建 logger
// 作用:
// 1. 默认在浏览器环境中 使用 console 输出日志
// 2. 创建日志对象时 默认该 logger 输出级别(只有当 日记输出级别 大于 默认输出级别时 才会输出日志)
module.exports = ({ level = "info", debug = false, console }) => {
	const debugFilters =
		typeof debug === "boolean"
			? [() => debug]
			: ([])
					.concat(debug)
					.map(filterToFunction);

	// 日志级别
	const loglevel = LogLevel[`${level}`] || 0;

	const logger = (name, type, args) => {
		// 标准化参数
		// 作用: 在参数数组中向头部添加 logger.name 参数 用于区分日志对象
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

		// 标识: 是否是 debug 模式
		const debug = debugFilters.some(f => f(name));
		switch (type) {
			case LogType.debug:
				if (!debug) return;
				if (typeof console.debug === "function") {
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
					if (typeof console.groupCollapsed === "function") {
						console.groupCollapsed(...labeledArgs());
					} else {
						console.log(...labeledArgs());
					}
					break;
				}
			// falls through
			case LogType.group:
				if (!debug && loglevel > LogLevel.log) return;
				if (typeof console.group === "function") {
					console.group(...labeledArgs());
				} else {
					console.log(...labeledArgs());
				}
				break;
			case LogType.groupEnd:
				if (!debug && loglevel > LogLevel.log) return;
				if (typeof console.groupEnd === "function") {
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
				if (typeof console.profile === "function") {
					console.profile(...labeledArgs());
				}
				break;
			case LogType.profileEnd:
				if (typeof console.profileEnd === "function") {
					console.profileEnd(...labeledArgs());
				}
				break;
			case LogType.clear:
				if (!debug && loglevel > LogLevel.log) return;
				if (typeof console.clear === "function") {
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
