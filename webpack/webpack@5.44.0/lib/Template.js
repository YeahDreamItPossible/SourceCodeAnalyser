"use strict";

const { ConcatSource, PrefixSource } = require("webpack-sources");

/** @typedef {import("webpack-sources").Source} Source */
/** @typedef {import("../declarations/WebpackOptions").Output} OutputOptions */
/** @typedef {import("./Chunk")} Chunk */
/** @typedef {import("./ChunkGraph")} ChunkGraph */
/** @typedef {import("./CodeGenerationResults")} CodeGenerationResults */
/** @typedef {import("./Compilation").AssetInfo} AssetInfo */
/** @typedef {import("./Compilation").PathData} PathData */
/** @typedef {import("./DependencyTemplates")} DependencyTemplates */
/** @typedef {import("./Module")} Module */
/** @typedef {import("./ModuleGraph")} ModuleGraph */
/** @typedef {import("./ModuleTemplate")} ModuleTemplate */
/** @typedef {import("./RuntimeModule")} RuntimeModule */
/** @typedef {import("./RuntimeTemplate")} RuntimeTemplate */
/** @typedef {import("./javascript/JavascriptModulesPlugin").ChunkRenderContext} ChunkRenderContext */
/** @typedef {import("./javascript/JavascriptModulesPlugin").RenderContext} RenderContext */
// 'a' 字符码
const START_LOWERCASE_ALPHABET_CODE = "a".charCodeAt(0);
// 'A' 字符码
const START_UPPERCASE_ALPHABET_CODE = "A".charCodeAt(0);
// 小写字母数量和 26
const DELTA_A_TO_Z = "z".charCodeAt(0) - START_LOWERCASE_ALPHABET_CODE + 1;
// a-z A-Z _ $ 字符数量和 54
const NUMBER_OF_IDENTIFIER_START_CHARS = DELTA_A_TO_Z * 2 + 2; // a-z A-Z _ $
// a-z A-Z _ $ 0-9 字符数量和64
const NUMBER_OF_IDENTIFIER_CONTINUATION_CHARS = NUMBER_OF_IDENTIFIER_START_CHARS + 10; // a-z A-Z _ $ 0-9
// 
const FUNCTION_CONTENT_REGEX = /^function\s?\(\)\s?\{\r?\n?|\r?\n?\}$/g;
// 
const INDENT_MULTILINE_REGEX = /^\t/gm;
// 
const LINE_SEPARATOR_REGEX = /\r?\n/g;
// 1. ^: 表示字符串的开始
// 2. ( 和 ): 是一个捕获组，用于捕获匹配的子字符串
// 3. [^a-zA-Z$_]: 是一个字符集（character set）。
// 		^ 在这里表示“非”的意思，所以这个字符集匹配任何不是小写字母（a-z）、大写字母（A-Z）、$ 符号或 _（下划线）的字符
// 所以: 匹配的是字符串开头的第一个字符，只要这个字符不是英文字母（无论大小写）、$ 或 _
const IDENTIFIER_NAME_REPLACE_REGEX = /^([^a-zA-Z$_])/;
// 全局匹配满足 非a-zA-Z0-9$_ 的字符
const IDENTIFIER_ALPHA_NUMERIC_NAME_REPLACE_REGEX = /[^a-zA-Z0-9$]+/g;
// 全局匹配满足 */ 的字符串
const COMMENT_END_REGEX = /\*\//g;
// 全局匹配满足 非a-zA-Z0-9_!§$()=\-^° 的字符
const PATH_NAME_NORMALIZE_REPLACE_REGEX = /[^a-zA-Z0-9_!§$()=\-^°]+/g;
// 全局匹配满足 以 - 开头 或者 以 - 结尾 的字符串
const MATCH_PADDED_HYPHENS_REPLACE_REGEX = /^-|-$/g;

// 模板
class Template {
	// 返回 标准化的函数字符串
	static getFunctionContent(fn) {
		return fn
			.toString()
			.replace(FUNCTION_CONTENT_REGEX, "")
			.replace(INDENT_MULTILINE_REGEX, "")
			.replace(LINE_SEPARATOR_REGEX, "\n");
	}

	// 将 字符串 转换成 以 _ 连接 的标识符
	// 示例: './src/math' => '_src_math_'
	static toIdentifier(str) {
		if (typeof str !== "string") return "";
		return str
			// /^([^a-zA-Z$_])/ 将 字符串 中开头的第一个字符 只要不是a-zA-Z$_ 替换成 _字符
			// 示例: '2h' => '_2h'
			.replace(IDENTIFIER_NAME_REPLACE_REGEX, "_$1")
			// /[^a-zA-Z0-9$]+/g 将 字符串 中不是[a-zA-Z0-9$_] 的字符 全部转换成 _
			// 'hello\nworld!' => 'hello_world_'
			.replace(IDENTIFIER_ALPHA_NUMERIC_NAME_REPLACE_REGEX, "_");
	}

	// 将 字符串 转换成 单行注释
	// 示例: 'hello world' => /*! hello world */
	static toComment(str) {
		if (!str) return "";
		return `/*! ${str.replace(COMMENT_END_REGEX, "* /")} */`;
	}

	// 将 字符串 转换成 正常单行注释
	// 示例: 'hello */ world' => /* hello * / world */
	static toNormalComment(str) {
		if (!str) return "";
		return `/* ${str.replace(COMMENT_END_REGEX, "* /")} */`;
	}

	// 将 字符串 转换成 路径
	// 示例: './src/index.js#frame' => 'src-index-js-frame'
	static toPath(str) {
		if (typeof str !== "string") return "";
		return str
			// 全局匹配满足 非a-zA-Z0-9_!§$()=\-^° 的字符 替换成 -
			.replace(PATH_NAME_NORMALIZE_REPLACE_REGEX, "-")
			// 全局匹配满足 以 - 开头 或者 以 - 结尾 的字符串 转换成 ''
			.replace(MATCH_PADDED_HYPHENS_REPLACE_REGEX, "");
	}

	// 将 Number 转换成 字符
	// Number < 54 时 单个字符
	// Number >= 54 时 多个字符
	static numberToIdentifier(n) {
		// n >= 54
		if (n >= NUMBER_OF_IDENTIFIER_START_CHARS) {
			// use multiple letters
			return (
				Template.numberToIdentifier(n % NUMBER_OF_IDENTIFIER_START_CHARS) +
				Template.numberToIdentifierContinuation(
					Math.floor(n / NUMBER_OF_IDENTIFIER_START_CHARS)
				)
			);
		}

		// 转换成小写字母
		// n < 26
		if (n < DELTA_A_TO_Z) {
			return String.fromCharCode(START_LOWERCASE_ALPHABET_CODE + n);
		}
		n -= DELTA_A_TO_Z;

		// 转换成大写字母
		// n < 26
		if (n < DELTA_A_TO_Z) {
			return String.fromCharCode(START_UPPERCASE_ALPHABET_CODE + n);
		}

		if (n === DELTA_A_TO_Z) return "_";
		return "$";
	}

	// 将 Number 转换成 字符串
	// Number < 64 时 单个字符
	// Number >= 64 时 多个字符
	static numberToIdentifierContinuation(n) {
		// n >= 64
		if (n >= NUMBER_OF_IDENTIFIER_CONTINUATION_CHARS) {
			// use multiple letters
			return (
				Template.numberToIdentifierContinuation(
					n % NUMBER_OF_IDENTIFIER_CONTINUATION_CHARS
				) +
				Template.numberToIdentifierContinuation(
					Math.floor(n / NUMBER_OF_IDENTIFIER_CONTINUATION_CHARS)
				)
			);
		}

		// 转换成小写字母
		// n < 26
		if (n < DELTA_A_TO_Z) {
			return String.fromCharCode(START_LOWERCASE_ALPHABET_CODE + n);
		}
		n -= DELTA_A_TO_Z;

		// upper case
		// n < 26
		if (n < DELTA_A_TO_Z) {
			return String.fromCharCode(START_UPPERCASE_ALPHABET_CODE + n);
		}
		n -= DELTA_A_TO_Z;

		// 转换成字符类型的数字0-9
		if (n < 10) {
			return `${n}`;
		}

		if (n === 10) return "_";
		return "$";
	}

	// 缩进
	// 将 字符串 中 换行符(\n)后非换行符(\n) 替换成 换行符 + 一个制表符
	// \t 是一个转义字符,代表一个制表符(Tab),就是空格
	// 示例: 'hello\nworld' => 'hello\n\tworld'
	static indent(s) {
		if (Array.isArray(s)) {
			return s.map(Template.indent).join("\n");
		} else {
			const str = s.trimRight();
			if (!str) return "";
			// 如果字符串首个字符是换行符 则该前缀为 空字符串
			// 否则该前缀为 单个制表符
			const ind = str[0] === "\n" ? "" : "\t";
			// 将 字符串 中 换行符(\n)后非换行符(\n) 替换成 换行符 + 一个制表符
			// 示例: 'hello\nworld' => 'hello\n\tworld'
			return ind + str.replace(/\n([^\n])/g, "\n\t$1");
		}
	}

	// 将 字符串 中 换行符(\n)后非换行符(\n) 替换成 换行符 + prefix
	// 示例: 'hello\nworld' => 'hello\n' + prefix +'world'
	static prefix(s, prefix) {
		const str = Template.asString(s).trim();
		if (!str) return "";
		const ind = str[0] === "\n" ? "" : prefix;
		// 将 字符串 中 换行符(\n)后非换行符(\n) 替换成 换行符 + prefix
		// 示例: 'hello\nworld' => 'hello\n' + prefix +'world'
		return ind + str.replace(/\n([^\n])/g, "\n" + prefix + "$1");
	}

	// 返回(数组拼接后的)字符串
	// 示例: ['hello', 'world'] => 'hello world'
	static asString(str) {
		if (Array.isArray(str)) {
			return str.join("\n");
		}
		return str;
	}

	// 返回数组的上限和下线
	// 如果某个模块Module.id 不是Number 则返回false
	static getModulesArrayBounds(modules) {
		let maxId = -Infinity;
		let minId = Infinity;
		for (const module of modules) {
			const moduleId = module.id;
			if (typeof moduleId !== "number") return false;
			if (maxId < moduleId) maxId = moduleId;
			if (minId > moduleId) minId = moduleId;
		}
		if (minId < 16 + ("" + minId).length) {
			// add minId x ',' instead of 'Array(minId).concat(…)'
			minId = 0;
		}
		// start with -1 because the first module needs no comma
		let objectOverhead = -1;
		for (const module of modules) {
			// module id + colon + comma
			objectOverhead += `${module.id}`.length + 2;
		}
		// number of commas, or when starting non-zero the length of Array(minId).concat()
		const arrayOverhead = minId === 0 ? maxId : 16 + `${minId}`.length + maxId;
		return arrayOverhead < objectOverhead ? [minId, maxId] : false;
	}

	// 返回 Source 的实例
	// 渲染 分块中的模块
	// 具体内容是打包后 __webpack_modules__ 变量内容
	// 示例: 
	// {
	// 		/***/ "./src/utils/math.js": 	
	// 		/*!****************************!*\
  // 		!*** ./src/imgs/cache.png ***!
  // 		\****************************/
	// 		/***/ ((module) => { ... })
	// }
	static renderChunkModules(renderContext, modules, renderModule, prefix = "") {
		const { chunkGraph } = renderContext;
		var source = new ConcatSource();
		if (modules.length === 0) {
			return null;
		}
		const allModules = modules.map(module => {
			return {
				id: chunkGraph.getModuleId(module),
				source: renderModule(module) || "false"
			};
		});
		// 当 Webpack.options.optimization.moduleIds = 'natural' 时
		// 或 Webpack.options.optimization.chunkIds = 'natural' 时
		// module.id 是 number
		const bounds = Template.getModulesArrayBounds(allModules);
		// 生成数组的形式
		if (bounds) {
			// Render a spare array
			const minId = bounds[0];
			const maxId = bounds[1];
			if (minId !== 0) {
				source.add(`Array(${minId}).concat(`);
			}
			source.add("[\n");
			/** @type {Map<string|number, {id: string|number, source: Source|string}>} */
			const modules = new Map();
			for (const module of allModules) {
				modules.set(module.id, module);
			}
			for (let idx = minId; idx <= maxId; idx++) {
				const module = modules.get(idx);
				if (idx !== minId) {
					source.add(",\n");
				}
				source.add(`/* ${idx} */`);
				if (module) {
					source.add("\n");
					source.add(module.source);
				}
			}
			source.add("\n" + prefix + "]");
			if (minId !== 0) {
				source.add(")");
			}
		} 
		// 生成对象的形式
		else {
			// Render an object
			source.add("{\n");
			for (let i = 0; i < allModules.length; i++) {
				const module = allModules[i];
				if (i !== 0) {
					source.add(",\n");
				}
				source.add(`\n/***/ ${JSON.stringify(module.id)}:\n`);
				source.add(module.source);
			}
			source.add(`\n\n${prefix}}`);
		}
		return source;
	}

	// 返回 Source 的实例
	// 渲染 运行时模块
	static renderRuntimeModules(runtimeModules, renderContext) {
		const source = new ConcatSource();
		for (const module of runtimeModules) {
			const codeGenerationResults = renderContext.codeGenerationResults;
			let runtimeSource;
			if (codeGenerationResults) {
				runtimeSource = codeGenerationResults.getSource(
					module,
					renderContext.chunk.runtime,
					"runtime"
				);
			} else {
				const codeGenResult = module.codeGeneration({
					chunkGraph: renderContext.chunkGraph,
					dependencyTemplates: renderContext.dependencyTemplates,
					moduleGraph: renderContext.moduleGraph,
					runtimeTemplate: renderContext.runtimeTemplate,
					runtime: renderContext.chunk.runtime
				});
				if (!codeGenResult) continue;
				runtimeSource = codeGenResult.sources.get("runtime");
			}
			if (runtimeSource) {
				source.add(Template.toNormalComment(module.identifier()) + "\n");
				if (!module.shouldIsolate()) {
					source.add(runtimeSource);
					source.add("\n\n");
				} else if (renderContext.runtimeTemplate.supportsArrowFunction()) {
					source.add("(() => {\n");
					if (renderContext.useStrict) source.add('\t"use strict";\n');
					source.add(new PrefixSource("\t", runtimeSource));
					source.add("\n})();\n\n");
				} else {
					source.add("!function() {\n");
					if (renderContext.useStrict) source.add('\t"use strict";\n');
					source.add(new PrefixSource("\t", runtimeSource));
					source.add("\n}();\n\n");
				}
			}
		}
		return source;
	}

	// 渲染 异步块中的运行时模块
	static renderChunkRuntimeModules(runtimeModules, renderContext) {
		return new PrefixSource(
			"/******/ ",
			new ConcatSource(
				"function(__webpack_require__) { // webpackRuntimeModules\n",
				'"use strict";\n\n',
				this.renderRuntimeModules(runtimeModules, renderContext),
				"}\n"
			)
		);
	}
}

module.exports = Template;
module.exports.NUMBER_OF_IDENTIFIER_START_CHARS = NUMBER_OF_IDENTIFIER_START_CHARS;
module.exports.NUMBER_OF_IDENTIFIER_CONTINUATION_CHARS = NUMBER_OF_IDENTIFIER_CONTINUATION_CHARS;
