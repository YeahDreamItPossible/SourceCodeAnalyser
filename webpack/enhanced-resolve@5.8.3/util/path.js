"use strict";

const path = require("path");

const CHAR_HASH = "#".charCodeAt(0);
const CHAR_SLASH = "/".charCodeAt(0);
const CHAR_BACKSLASH = "\\".charCodeAt(0);
const CHAR_A = "A".charCodeAt(0);
const CHAR_Z = "Z".charCodeAt(0);
const CHAR_LOWER_A = "a".charCodeAt(0);
const CHAR_LOWER_Z = "z".charCodeAt(0);
const CHAR_DOT = ".".charCodeAt(0);
const CHAR_COLON = ":".charCodeAt(0);

const posixNormalize = path.posix.normalize;
const winNormalize = path.win32.normalize;

// 路径类型
const PathType = Object.freeze({
	Empty: 0, // 空路径
	Normal: 1, // 标准路径
	Relative: 2, // 相对路径
	AbsoluteWin: 3, // window下的绝对路径
	AbsolutePosix: 4, // 可移植操作下的绝对路径
	Internal: 5 // 路径片段
});
exports.PathType = PathType;

/**
 * @param {string} p a path
 * @returns {PathType} type of path
 */
// 
const getType = p => {
	switch (p.length) {
		case 0:
			return PathType.Empty;
		case 1: {
			const c0 = p.charCodeAt(0);
			switch (c0) {
				case CHAR_DOT:
					return PathType.Relative;
				case CHAR_SLASH:
					return PathType.AbsolutePosix;
				case CHAR_HASH:
					return PathType.Internal;
			}
			return PathType.Normal;
		}
		case 2: {
			const c0 = p.charCodeAt(0);
			switch (c0) {
				case CHAR_DOT: {
					const c1 = p.charCodeAt(1);
					switch (c1) {
						case CHAR_DOT:
						case CHAR_SLASH:
							return PathType.Relative;
					}
					return PathType.Normal;
				}
				case CHAR_SLASH:
					return PathType.AbsolutePosix;
				case CHAR_HASH:
					return PathType.Internal;
			}
			const c1 = p.charCodeAt(1);
			if (c1 === CHAR_COLON) {
				if (
					(c0 >= CHAR_A && c0 <= CHAR_Z) ||
					(c0 >= CHAR_LOWER_A && c0 <= CHAR_LOWER_Z)
				) {
					return PathType.AbsoluteWin;
				}
			}
			return PathType.Normal;
		}
	}

	// 根据路径前缀来判断路径类型
	const c0 = p.charCodeAt(0);
	switch (c0) {
		// 以 . 开头
		case CHAR_DOT: {
			const c1 = p.charCodeAt(1);
			switch (c1) {
				// 以 ./ 开头 标识相对路径
				case CHAR_SLASH:
					return PathType.Relative;
				// 以 .. 开头
				case CHAR_DOT: {
					const c2 = p.charCodeAt(2);
					if (c2 === CHAR_SLASH) return PathType.Relative;
					return PathType.Normal;
				}
			}
			return PathType.Normal;
		}
		// 以 / 开头 标识可移植操作下的绝对路径
		case CHAR_SLASH:
			return PathType.AbsolutePosix;
		// 以 # 开头
		case CHAR_HASH:
			return PathType.Internal;
	}

	// 判断是不是windox下的绝对路径
	// 示例: C:\\Demo\\say.js
	const c1 = p.charCodeAt(1);
	if (c1 === CHAR_COLON) {
		const c2 = p.charCodeAt(2);
		if (
			(c2 === CHAR_BACKSLASH || c2 === CHAR_SLASH) &&
			((c0 >= CHAR_A && c0 <= CHAR_Z) ||
				(c0 >= CHAR_LOWER_A && c0 <= CHAR_LOWER_Z))
		) {
			return PathType.AbsoluteWin;
		}
	}

	// 默认返回
	return PathType.Normal;
};
exports.getType = getType;

/**
 * @param {string} p a path
 * @returns {string} the normalized path
 */
const normalize = p => {
	switch (getType(p)) {
		case PathType.Empty:
			return p;
		case PathType.AbsoluteWin:
			return winNormalize(p);
		case PathType.Relative: {
			const r = posixNormalize(p);
			return getType(r) === PathType.Relative ? r : `./${r}`;
		}
	}
	return posixNormalize(p);
};
exports.normalize = normalize;

/**
 * @param {string} rootPath the root path
 * @param {string | undefined} request the request path
 * @returns {string} the joined path
 */
// 连接路径
const join = (rootPath, request) => {
	if (!request) return normalize(rootPath);
	const requestType = getType(request);
	switch (requestType) {
		case PathType.AbsolutePosix:
			return posixNormalize(request);
		case PathType.AbsoluteWin:
			return winNormalize(request);
	}
	switch (getType(rootPath)) {
		case PathType.Normal:
		case PathType.Relative:
		case PathType.AbsolutePosix:
			return posixNormalize(`${rootPath}/${request}`);
		case PathType.AbsoluteWin:
			return winNormalize(`${rootPath}\\${request}`);
	}
	switch (requestType) {
		case PathType.Empty:
			return rootPath;
		case PathType.Relative: {
			const r = posixNormalize(rootPath);
			return getType(r) === PathType.Relative ? r : `./${r}`;
		}
	}
	return posixNormalize(rootPath);
};
exports.join = join;

const joinCache = new Map();

/**
 * @param {string} rootPath the root path
 * @param {string | undefined} request the request path
 * @returns {string} the joined path
 */
const cachedJoin = (rootPath, request) => {
	let cacheEntry;
	let cache = joinCache.get(rootPath);
	if (cache === undefined) {
		joinCache.set(rootPath, (cache = new Map()));
	} else {
		cacheEntry = cache.get(request);
		if (cacheEntry !== undefined) return cacheEntry;
	}
	cacheEntry = join(rootPath, request);
	cache.set(request, cacheEntry);
	return cacheEntry;
};
exports.cachedJoin = cachedJoin;

const checkExportsFieldTarget = relativePath => {
	let lastNonSlashIndex = 2;
	let slashIndex = relativePath.indexOf("/", 2);
	let cd = 0;

	while (slashIndex !== -1) {
		const folder = relativePath.slice(lastNonSlashIndex, slashIndex);

		switch (folder) {
			case "..": {
				cd--;
				if (cd < 0)
					return new Error(
						`Trying to access out of package scope. Requesting ${relativePath}`
					);
				break;
			}
			default:
				cd++;
				break;
		}

		lastNonSlashIndex = slashIndex + 1;
		slashIndex = relativePath.indexOf("/", lastNonSlashIndex);
	}
};
exports.checkExportsFieldTarget = checkExportsFieldTarget;
