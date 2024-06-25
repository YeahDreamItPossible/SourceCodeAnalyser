"use strict";

const { RawSource } = require("webpack-sources");
const ConcatenationScope = require("../ConcatenationScope");
const { UsageState } = require("../ExportsInfo");
const Generator = require("../Generator");
const RuntimeGlobals = require("../RuntimeGlobals");

// 将 数据 序列化 并替换掉空格
const stringifySafe = data => {
	// 数据序列化
	const stringified = JSON.stringify(data);
	if (!stringified) {
		return undefined; // Invalid JSON
	}

	// 替换空格
	return stringified.replace(/\u2028|\u2029/g, str =>
		str === "\u2029" ? "\\u2029" : "\\u2028"
	); // invalid in JavaScript but valid JSON
};

// 
const createObjectForExportsInfo = (data, exportsInfo, runtime) => {
	if (exportsInfo.otherExportsInfo.getUsed(runtime) !== UsageState.Unused)
		return data;
	const isArray = Array.isArray(data);
	const reducedData = isArray ? [] : {};
	for (const key of Object.keys(data)) {
		const exportInfo = exportsInfo.getReadOnlyExportInfo(key);
		const used = exportInfo.getUsed(runtime);
		if (used === UsageState.Unused) continue;

		let value;
		if (used === UsageState.OnlyPropertiesUsed && exportInfo.exportsInfo) {
			value = createObjectForExportsInfo(
				data[key],
				exportInfo.exportsInfo,
				runtime
			);
		} else {
			value = data[key];
		}
		const name = exportInfo.getUsedName(key, runtime);
		reducedData[name] = value;
	}
	if (isArray) {
		let arrayLengthWhenUsed =
			exportsInfo.getReadOnlyExportInfo("length").getUsed(runtime) !==
			UsageState.Unused
				? data.length
				: undefined;

		let sizeObjectMinusArray = 0;
		for (let i = 0; i < reducedData.length; i++) {
			if (reducedData[i] === undefined) {
				sizeObjectMinusArray -= 2;
			} else {
				sizeObjectMinusArray += `${i}`.length + 3;
			}
		}
		if (arrayLengthWhenUsed !== undefined) {
			sizeObjectMinusArray +=
				`${arrayLengthWhenUsed}`.length +
				8 -
				(arrayLengthWhenUsed - reducedData.length) * 2;
		}
		if (sizeObjectMinusArray < 0)
			return Object.assign(
				arrayLengthWhenUsed === undefined
					? {}
					: { length: arrayLengthWhenUsed },
				reducedData
			);
		const generatedLength =
			arrayLengthWhenUsed !== undefined
				? Math.max(arrayLengthWhenUsed, reducedData.length)
				: reducedData.length;
		for (let i = 0; i < generatedLength; i++) {
			if (reducedData[i] === undefined) {
				reducedData[i] = 0;
			}
		}
	}
	return reducedData;
};

const TYPES = new Set(["javascript"]);

// JSON类型 代码生成器
class JsonGenerator extends Generator {
	// 返回当前生成器类型
	getTypes(module) {
		return TYPES;
	}

	// 返回模块大小
	getSize(module, type) {
		let data =
			module.buildInfo &&
			module.buildInfo.jsonData &&
			module.buildInfo.jsonData.get();
		if (!data) return 0;
		return stringifySafe(data).length + 10;
	}

	getConcatenationBailoutReason(module, context) {
		return undefined;
	}

	// 生成代码
	generate(
		module,
		{
			moduleGraph,
			runtimeTemplate,
			runtimeRequirements,
			runtime,
			concatenationScope
		}
	) {
		const data =
			module.buildInfo &&
			module.buildInfo.jsonData &&
			module.buildInfo.jsonData.get();
		if (data === undefined) {
			return new RawSource(
				runtimeTemplate.missingModuleStatement({
					request: module.rawRequest
				})
			);
		}
		const exportsInfo = moduleGraph.getExportsInfo(module);
		let finalJson =
			typeof data === "object" &&
			data &&
			exportsInfo.otherExportsInfo.getUsed(runtime) === UsageState.Unused
				? createObjectForExportsInfo(data, exportsInfo, runtime)
				: data;
		// Use JSON because JSON.parse() is much faster than JavaScript evaluation
		const jsonStr = stringifySafe(finalJson);
		const jsonExpr =
			jsonStr.length > 20 && typeof finalJson === "object"
				? `JSON.parse('${jsonStr.replace(/[\\']/g, "\\$&")}')`
				: jsonStr;
		let content;
		if (concatenationScope) {
			content = `${runtimeTemplate.supportsConst() ? "const" : "var"} ${
				ConcatenationScope.NAMESPACE_OBJECT_EXPORT
			} = ${jsonExpr};`;
			concatenationScope.registerNamespaceExport(
				ConcatenationScope.NAMESPACE_OBJECT_EXPORT
			);
		} else {
			runtimeRequirements.add(RuntimeGlobals.module);
			content = `${module.moduleArgument}.exports = ${jsonExpr};`;
		}
		return new RawSource(content);
	}
}

module.exports = JsonGenerator;
