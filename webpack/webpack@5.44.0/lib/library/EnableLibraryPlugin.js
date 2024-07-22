"use strict";

// WeakMap<Compiler, Set<LibraryType>>
const enabledTypes = new WeakMap();
const getEnabledTypes = compiler => {
	let set = enabledTypes.get(compiler);
	if (set === undefined) {
		set = new Set();
		enabledTypes.set(compiler, set);
	}
	return set;
};

/**
 * Webpack.options.output.library.type
 * var | assign | assign-properties
 * this | window | global
 * commonjs | commonjs2 | module | amd | amd-require | umd | umd2
 * system | json | commonjs-module
 * var:
 * 导出一个全局变量 
 * 示例: `var libraryName = ...`
 * assign:
 * 导出一个变量 并将该变量默认绑定在某个对象上
 * 1. 如果 Webpack.options.output.library.name 值为数组形式 将默认绑定到数组第一个值上
 * 		示例: 
 * 				Webpack.options.output.library.name = ['MyNamespace', 'MyLibrary']
 * 				=> (MyNamespace = typeof MyNamespace === "undefined" ? {} : MyNamespace).MyLibrary = '...'
 * 2. 如果 Webpack.options.output.library.name 值为字符串形式 将默认绑定到全局对象(window | global)上
 * 		此时 导出的是一个隐藏的全局变量
 * 		示例:
 * 				Webpack.options.output.library.name = 'MyLibrary'
 * 				=> { MyNamespace = '...' }
 * assign-properties:
 * 与 assign 类似 但是更安全
 * 如果 已经存在 MyLibrary 时 将会重用 MyLibrary
 * 并将 导出的属性 依次绑定到 MyLibrary
 * 		示例:
 * 				var __webpack_export_target__ = ((MyNamespace = typeof MyNamespace === "undefined" ? {} : MyNamespace).MyPlugin = MyNamespace.MyPlugin || {})
 * 				// __webpack_exports__ 表示 MyLibrary 导出的属性
 * 				for(var i in __webpack_exports__) __webpack_export_target__[i] = __webpack_exports__[i];
 * this:
 * 将绑定到 this 对象上
 * 		示例:
 * 				this.MyLibrary = '...'
 * window:
 * 将绑定到 window 对象上
 * 		示例:
 * 				window.MyLibrary = '...'
 * global:
 * 取决于 target 值 全局对象可以分别改变 例如: self、global 或者 globalThis
 * 		示例:
 * 				self.MyLibrary = '...'
 * commonjs:
 * 在 CommonJS 环境中运行 绑定到 exports 上
 * 		示例:
 * 				exports.MyLibrary = '...'
 * commonjs2:
 * 在 CommonJS 环境中运行 绑定到 module.exports 上
 * 		示例:
 * 				module.exports.MyLibrary = '...'
 * module:
 * 输出 ES 模块 前提是: Webpack.options.experiments.outputModul = true
 * 		示例:
 * 				exports { __webpack_exports__default as default }
 * amd:
 * 以 AMD 模块格式导出
 * amd-require:
 * 立即执行的 AMD require(dependencies, factory) 包装器来打包输出
 * umd:
 * 以 umd 模块格式 导出
 * umd2:
 * 与 umd 感觉没啥区别
 * system:
 * webpack@4.30 特性 可跳过
 * json:
 * TODO:
 */

// 输出库的类型
// var | assign | assign-properties
// this | window | global
// commonjs | commonjs2 | module | amd | amd-require | umd | umd2
// system | json | commonjs-module
// 作用:
// 
class EnableLibraryPlugin {
	constructor(type) {
		this.type = type;
	}

	// 添加 自定义输出库 类型
	static setEnabled(compiler, type) {
		getEnabledTypes(compiler).add(type);
	}

	// 检查 某个库类型 是否存在
	static checkEnabled(compiler, type) {
		if (!getEnabledTypes(compiler).has(type)) {
			throw new Error(
				`Library type "${type}" is not enabled. ` +
					"EnableLibraryPlugin need to be used to enable this type of library. " +
					'This usually happens through the "output.enabledLibraryTypes" option. ' +
					'If you are using a function as entry which sets "library", you need to add all potential library types to "output.enabledLibraryTypes". ' +
					"These types are enabled: " +
					Array.from(getEnabledTypes(compiler)).join(", ")
			);
		}
	}

	apply(compiler) {
		const { type } = this;

		// Only enable once
		const enabled = getEnabledTypes(compiler);
		if (enabled.has(type)) return;
		enabled.add(type);

		if (typeof type === "string") {
			const enableExportProperty = () => {
				const ExportPropertyTemplatePlugin = require("./ExportPropertyLibraryPlugin");
				new ExportPropertyTemplatePlugin({
					type,
					nsObjectUsed: type !== "module"
				}).apply(compiler);
			};
			switch (type) {
				case "var": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: [],
						declare: "var",
						unnamed: "error"
					}).apply(compiler);
					break;
				}
				case "assign-properties": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: [],
						declare: false,
						unnamed: "error",
						named: "copy"
					}).apply(compiler);
					break;
				}
				case "assign": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: [],
						declare: false,
						unnamed: "error"
					}).apply(compiler);
					break;
				}
				case "this": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: ["this"],
						declare: false,
						unnamed: "copy"
					}).apply(compiler);
					break;
				}
				case "window": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: ["window"],
						declare: false,
						unnamed: "copy"
					}).apply(compiler);
					break;
				}
				case "self": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: ["self"],
						declare: false,
						unnamed: "copy"
					}).apply(compiler);
					break;
				}
				case "global": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: "global",
						declare: false,
						unnamed: "copy"
					}).apply(compiler);
					break;
				}
				case "commonjs": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: ["exports"],
						declare: false,
						unnamed: "copy"
					}).apply(compiler);
					break;
				}
				case "commonjs2":
				case "commonjs-module": {
					//@ts-expect-error https://github.com/microsoft/TypeScript/issues/41697
					const AssignLibraryPlugin = require("./AssignLibraryPlugin");
					new AssignLibraryPlugin({
						type,
						prefix: ["module", "exports"],
						declare: false,
						unnamed: "assign"
					}).apply(compiler);
					break;
				}
				case "amd":
				case "amd-require": {
					enableExportProperty();
					const AmdLibraryPlugin = require("./AmdLibraryPlugin");
					new AmdLibraryPlugin({
						type,
						requireAsWrapper: type === "amd-require"
					}).apply(compiler);
					break;
				}
				case "umd":
				case "umd2": {
					enableExportProperty();
					const UmdLibraryPlugin = require("./UmdLibraryPlugin");
					new UmdLibraryPlugin({
						type,
						optionalAmdExternalAsGlobal: type === "umd2"
					}).apply(compiler);
					break;
				}
				case "system": {
					enableExportProperty();
					const SystemLibraryPlugin = require("./SystemLibraryPlugin");
					new SystemLibraryPlugin({
						type
					}).apply(compiler);
					break;
				}
				case "jsonp": {
					enableExportProperty();
					const JsonpLibraryPlugin = require("./JsonpLibraryPlugin");
					new JsonpLibraryPlugin({
						type
					}).apply(compiler);
					break;
				}
				case "module": {
					enableExportProperty();
					const ModuleLibraryPlugin = require("./ModuleLibraryPlugin");
					new ModuleLibraryPlugin({
						type
					}).apply(compiler);
					break;
				}
				default:
					throw new Error(`Unsupported library type ${type}.
Plugins which provide custom library types must call EnableLibraryPlugin.setEnabled(compiler, type) to disable this error.`);
			}
		} else {
			// TODO support plugin instances here
			// apply them to the compiler
		}
	}
}

module.exports = EnableLibraryPlugin;
