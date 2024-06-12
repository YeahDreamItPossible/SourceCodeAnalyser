"use strict";

/**
 * Source Map 文件类似 JSON 格式 有以下属性
 * version: Source Map的版本 目前为 3
 * file: 转换后的文件名(即: 浏览器实际加载并执行的Javascript文件名)
 * sourceRoot: 转换前的源代码文件所在目录
 * sources: 转换前的源代码文件的路径
 * sourcesContent: 转换前的源代码
 * names: 转换前的所有变量名和属性名
 * mappings: 记录位置信息的字符串
 */

/**
 * mappings 特点
 * 分号(;): 每个分号对应转换后源码的一行
 * 逗号(,): 每个逗号对应转换后代码的一段代码内容
 * 字符(): 逗号或者分号之间的字符是以 Base64 VLQ 编码规则存储的位置信息
 */

/**
 * 第一层是行对应，以分号（;）表示，每个分号对应转换后源码的一行。所以，第一个分号前的内容，就对应源码的第一行，以此类推。
 * 第二层是位置对应，以逗号（,）表示，每个逗号对应转换后源码的一个位置。所以，第一个逗号前的内容，就对应该行源码的第一个位置，以此类推。
 * 第三层是位置转换，以VLQ编码表示，代表该位置对应的转换前的源码位置。
 */


/**
 * 位置对应的原理
 * 每个位置使用五位,表示五个字段, 从左边算起
 * 第一位，表示这个位置在（转换后的代码的）的第几列。(因为压缩后的代码就一行，所以只需要表示第几列就行了)
 * 第二位，表示这个位置属于sources属性中的哪一个文件。
 * 第三位，表示这个位置属于转换前代码的第几行。
 * 第四位，表示这个位置属于转换前代码的第几列。
 * 第五位，表示这个位置属于names属性中的哪一个变量
 * 首先，所有的值都是以0作为基数的。
 * 其次，第五位不是必需的，如果该位置没有对应names属性中的变量，可以省略第五位。
 * 再次，每一位都采用VLQ编码表示；由于VLQ编码是变长的，所以每一位可以由多个字符构成
 * 如果某个位置是AAAAA，由于A在VLQ编码中表示0，因此这个位置的五个位实际上都是0。
 * 它的意思是，
 * 该位置在转换后代码的第0列，
 * 对应sources属性中第0个文件，
 * 属于转换前代码的第0行第0列，
 * 对应names属性中的第0个变量。
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(
	""
);

const CONTINUATION_BIT = 0x20;

const createMappingsSerializer = options => {
	const linesOnly = options && options.columns === false;
	return linesOnly
		? createLinesOnlyMappingsSerializer()
		: createFullMappingsSerializer();
};

const createFullMappingsSerializer = () => {
	let currentLine = 1;
	let currentColumn = 0;
	let currentSourceIndex = 0;
	let currentOriginalLine = 1;
	let currentOriginalColumn = 0;
	let currentNameIndex = 0;
	let activeMapping = false;
	let activeName = false;
	let initial = true;
	return (
		generatedLine,
		generatedColumn,
		sourceIndex,
		originalLine,
		originalColumn,
		nameIndex
	) => {
		if (activeMapping && currentLine === generatedLine) {
			// A mapping is still active
			if (
				sourceIndex === currentSourceIndex &&
				originalLine === currentOriginalLine &&
				originalColumn === currentOriginalColumn &&
				!activeName &&
				nameIndex < 0
			) {
				// avoid repeating the same original mapping
				return "";
			}
		} else {
			// No mapping is active
			if (sourceIndex < 0) {
				// avoid writing unneccessary generated mappings
				return "";
			}
		}

		let str;
		if (currentLine < generatedLine) {
			str = ";".repeat(generatedLine - currentLine);
			currentLine = generatedLine;
			currentColumn = 0;
			initial = false;
		} else if (initial) {
			str = "";
			initial = false;
		} else {
			str = ",";
		}

		const writeValue = value => {
			const sign = (value >>> 31) & 1;
			const mask = value >> 31;
			const absValue = (value + mask) ^ mask;
			let data = (absValue << 1) | sign;
			for (;;) {
				const sextet = data & 0x1f;
				data >>= 5;
				if (data === 0) {
					str += ALPHABET[sextet];
					break;
				} else {
					str += ALPHABET[sextet | CONTINUATION_BIT];
				}
			}
		};
		writeValue(generatedColumn - currentColumn);
		currentColumn = generatedColumn;
		if (sourceIndex >= 0) {
			activeMapping = true;
			if (sourceIndex === currentSourceIndex) {
				str += "A";
			} else {
				writeValue(sourceIndex - currentSourceIndex);
				currentSourceIndex = sourceIndex;
			}
			writeValue(originalLine - currentOriginalLine);
			currentOriginalLine = originalLine;
			if (originalColumn === currentOriginalColumn) {
				str += "A";
			} else {
				writeValue(originalColumn - currentOriginalColumn);
				currentOriginalColumn = originalColumn;
			}
			if (nameIndex >= 0) {
				writeValue(nameIndex - currentNameIndex);
				currentNameIndex = nameIndex;
				activeName = true;
			} else {
				activeName = false;
			}
		} else {
			activeMapping = false;
		}
		return str;
	};
};

const createLinesOnlyMappingsSerializer = () => {
	let lastWrittenLine = 0;
	let currentLine = 1;
	let currentSourceIndex = 0;
	let currentOriginalLine = 1;
	return (
		generatedLine,
		_generatedColumn,
		sourceIndex,
		originalLine,
		_originalColumn,
		_nameIndex
	) => {
		if (sourceIndex < 0) {
			// avoid writing generated mappings at all
			return "";
		}
		if (lastWrittenLine === generatedLine) {
			// avoid writing multiple original mappings per line
			return "";
		}
		let str;
		const writeValue = value => {
			const sign = (value >>> 31) & 1;
			const mask = value >> 31;
			const absValue = (value + mask) ^ mask;
			let data = (absValue << 1) | sign;
			for (;;) {
				const sextet = data & 0x1f;
				data >>= 5;
				if (data === 0) {
					str += ALPHABET[sextet];
					break;
				} else {
					str += ALPHABET[sextet | CONTINUATION_BIT];
				}
			}
		};
		lastWrittenLine = generatedLine;
		if (generatedLine === currentLine + 1) {
			currentLine = generatedLine;
			if (sourceIndex === currentSourceIndex) {
				currentSourceIndex = sourceIndex;
				if (originalLine === currentOriginalLine + 1) {
					currentOriginalLine = originalLine;
					return ";AACA";
				} else {
					str = ";AA";
					writeValue(originalLine - currentOriginalLine);
					currentOriginalLine = originalLine;
					return str + "A";
				}
			} else {
				str = ";A";
				writeValue(sourceIndex - currentSourceIndex);
				currentSourceIndex = sourceIndex;
				writeValue(originalLine - currentOriginalLine);
				currentOriginalLine = originalLine;
				return str + "A";
			}
		} else {
			str = ";".repeat(generatedLine - currentLine);
			currentLine = generatedLine;
			if (sourceIndex === currentSourceIndex) {
				currentSourceIndex = sourceIndex;
				if (originalLine === currentOriginalLine + 1) {
					currentOriginalLine = originalLine;
					return str + "AACA";
				} else {
					str += "AA";
					writeValue(originalLine - currentOriginalLine);
					currentOriginalLine = originalLine;
					return str + "A";
				}
			} else {
				str += "A";
				writeValue(sourceIndex - currentSourceIndex);
				currentSourceIndex = sourceIndex;
				writeValue(originalLine - currentOriginalLine);
				currentOriginalLine = originalLine;
				return str + "A";
			}
		}
	};
};

module.exports = createMappingsSerializer;
