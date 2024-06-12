"use strict";

const createMappingsSerializer = require("./createMappingsSerializer");

exports.getSourceAndMap = (inputSource, options) => {
	let code = "";
	let mappings = "";
	let sources = [];
	let sourcesContent = [];
	let names = [];
	const addMapping = createMappingsSerializer(options);
	const { source } = inputSource.streamChunks(
		Object.assign({}, options, { finalSource: true }),
		(
			chunk,
			generatedLine,
			generatedColumn,
			sourceIndex,
			originalLine,
			originalColumn,
			nameIndex
		) => {
			if (chunk !== undefined) code += chunk;
			mappings += addMapping(
				generatedLine,
				generatedColumn,
				sourceIndex,
				originalLine,
				originalColumn,
				nameIndex
			);
		},
		(sourceIndex, source, sourceContent) => {
			while (sources.length < sourceIndex) {
				sources.push(null);
			}
			sources[sourceIndex] = source;
			if (sourceContent !== undefined) {
				while (sourcesContent.length < sourceIndex) {
					sourcesContent.push(null);
				}
				sourcesContent[sourceIndex] = sourceContent;
			}
		},
		(nameIndex, name) => {
			while (names.length < nameIndex) {
				names.push(null);
			}
			names[nameIndex] = name;
		}
	);
	return {
		source: source !== undefined ? source : code, // 加工后的源代码(经过 Source.streamChunks 加工的源代码)
		map:
			mappings.length > 0
				? {
						version: 3,
						file: "x",
						mappings,
						sources,
						sourcesContent:
							sourcesContent.length > 0 ? sourcesContent : undefined, // 源代码(创建 Source 实例的源代码)
						names
				  }
				: null
	};
};

exports.getMap = (source, options) => {
	let mappings = "";
	let sources = [];
	let sourcesContent = [];
	let names = [];
	const addMapping = createMappingsSerializer(options);
	source.streamChunks(
		Object.assign({}, options, { source: false, finalSource: true }),
		(
			chunk,
			generatedLine,
			generatedColumn,
			sourceIndex,
			originalLine,
			originalColumn,
			nameIndex
		) => {
			mappings += addMapping(
				generatedLine,
				generatedColumn,
				sourceIndex,
				originalLine,
				originalColumn,
				nameIndex
			);
		},
		(sourceIndex, source, sourceContent) => {
			while (sources.length < sourceIndex) {
				sources.push(null);
			}
			sources[sourceIndex] = source;
			if (sourceContent !== undefined) {
				while (sourcesContent.length < sourceIndex) {
					sourcesContent.push(null);
				}
				sourcesContent[sourceIndex] = sourceContent;
			}
		},
		(nameIndex, name) => {
			while (names.length < nameIndex) {
				names.push(null);
			}
			names[nameIndex] = name;
		}
	);
	return mappings.length > 0
		? {
				version: 3,
				file: "x",
				mappings,
				sources,
				sourcesContent: sourcesContent.length > 0 ? sourcesContent : undefined,
				names
		  }
		: null;
};
