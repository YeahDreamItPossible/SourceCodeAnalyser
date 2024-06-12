const defineExport = (name, fn) => {
	let value;
	Object.defineProperty(exports, name, {
		get: () => {
			if (fn !== undefined) {
				value = fn();
				fn = undefined;
			}
			return value;
		},
		configurable: true
	});
};

// Windows：系统行末结束符是 ‘\r\n’
// Linux：统行末结束符是 ‘\n’
// Mac：系统行末结束符是 ‘\r’

// 源代码
defineExport("Source", () => require("./Source"));
// 原始数据源
defineExport("RawSource", () => require("./RawSource"));
// 初始源代码
defineExport("OriginalSource", () => require("./OriginalSource"));
// 源映射源代码
defineExport("SourceMapSource", () => require("./SourceMapSource"));
// 缓存源代码
defineExport("CachedSource", () => require("./CachedSource"));
// 拼接源代码
defineExport("ConcatSource", () => require("./ConcatSource"));
// 替换源代码
defineExport("ReplaceSource", () => require("./ReplaceSource"));
// 前缀源代码
defineExport("PrefixSource", () => require("./PrefixSource"));
// 
defineExport("SizeOnlySource", () => require("./SizeOnlySource"));
// 兼容源代码
defineExport("CompatSource", () => require("./CompatSource"));
