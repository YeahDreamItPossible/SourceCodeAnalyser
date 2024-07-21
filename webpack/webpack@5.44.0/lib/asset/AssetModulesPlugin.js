"use strict";

const { cleverMerge } = require("../util/cleverMerge");
const { compareModulesByIdentifier } = require("../util/comparators");
const createSchemaValidation = require("../util/create-schema-validation");
const memoize = require("../util/memoize");

const getSchema = name => {
	const { definitions } = require("../../schemas/WebpackOptions.json");
	return {
		definitions,
		oneOf: [{ $ref: `#/definitions/${name}` }]
	};
};

const generatorValidationOptions = {
	name: "Asset Modules Plugin",
	baseDataPath: "generator"
};
const validateGeneratorOptions = {
	asset: createSchemaValidation(
		require("../../schemas/plugins/asset/AssetGeneratorOptions.check.js"),
		() => getSchema("AssetGeneratorOptions"),
		generatorValidationOptions
	),
	"asset/resource": createSchemaValidation(
		require("../../schemas/plugins/asset/AssetResourceGeneratorOptions.check.js"),
		() => getSchema("AssetResourceGeneratorOptions"),
		generatorValidationOptions
	),
	"asset/inline": createSchemaValidation(
		require("../../schemas/plugins/asset/AssetInlineGeneratorOptions.check.js"),
		() => getSchema("AssetInlineGeneratorOptions"),
		generatorValidationOptions
	)
};

const validateParserOptions = createSchemaValidation(
	require("../../schemas/plugins/asset/AssetParserOptions.check.js"),
	() => getSchema("AssetParserOptions"),
	{
		name: "Asset Modules Plugin",
		baseDataPath: "parser"
	}
);

const getAssetGenerator = memoize(() => require("./AssetGenerator"));
const getAssetParser = memoize(() => require("./AssetParser"));
const getAssetSourceParser = memoize(() => require("./AssetSourceParser"));
const getAssetSourceGenerator = memoize(() =>
	require("./AssetSourceGenerator")
);

const type = "asset";
const plugin = "AssetModulesPlugin";

/**
 * Data URL(数据地址):
 * 其允许内容创建者向文档中嵌入小文件
 * 语法:
 * 前缀(data:)、指示数据类型的 MIME 类型、如果非文本则为可选的 base64 标记、数据本身
 * data:[<mediatype>][;base64],<data>
 */

/**
 * 资源模块(asset module):
 * 一种模块类型 允许直接使用文件资源(字体，图标等)而无需配置额外 loader
 */

/**
 * 资源模块分类(asset module type):
 * 1. 内敛资源(asset/inline)
 * 		作用: 
 * 		将资源作为一个Data URL(Base64编码的URL)直接嵌入到生成的文件中
 * 		webpack5之前使用 url-loader 实现
 * 2. 源码资源(asset/source)
 * 		作用:
 * 		导出资源的源代码
 * 		webpack5之前使用 raw-loader 实现
 * 3. 文件资源(asset/resource)
 * 		作用：
 * 		将 文件资源 复制到输出目录 并返回一个（相对于输出目录的）URL
 * 		webpack5之前使用 raw-loader 实现
 * 4. 资源(asset)
 * 		作用:
 * 		在将 文件资源 以 asset/source | asset/resource 的方式自动选择
 */

// 资源模块插件
// 作用:
// 注册特定资源模块类型的语法分析器 代码生成器
// asset | asset/inline | asset/source | asset/resource
class AssetModulesPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap(
			plugin,
			(compilation, { normalModuleFactory }) => {
				// 资源语法分析器
				normalModuleFactory.hooks.createParser
					.for("asset")
					.tap(plugin, parserOptions => {
						validateParserOptions(parserOptions);
						parserOptions = cleverMerge(
							compiler.options.module.parser.asset,
							parserOptions
						);

						let dataUrlCondition = parserOptions.dataUrlCondition;
						if (!dataUrlCondition || typeof dataUrlCondition === "object") {
							dataUrlCondition = {
								// 如果一个模块源码大小 module.size < maxSize，那么模块会被作为一个 Base64 编码的字符串注入到包中
								// 否则模块文件会被生成到输出的目标目录中
								maxSize: 8096,
								...dataUrlCondition
							};
						}

						const AssetParser = getAssetParser();

						return new AssetParser(dataUrlCondition);
					});
				// 内敛资源语法分析器
				normalModuleFactory.hooks.createParser
					.for("asset/inline")
					.tap(plugin, parserOptions => {
						const AssetParser = getAssetParser();

						return new AssetParser(true);
					});
				// 文件资源语法分析器
				normalModuleFactory.hooks.createParser
					.for("asset/resource")
					.tap(plugin, parserOptions => {
						const AssetParser = getAssetParser();

						return new AssetParser(false);
					});
				// 源码资源语法分析器
				normalModuleFactory.hooks.createParser
					.for("asset/source")
					.tap(plugin, parserOptions => {
						const AssetSourceParser = getAssetSourceParser();

						return new AssetSourceParser();
					});

				// 资源代码生成器 行内资源代码生成器 文件资源代码生成器
				for (const type of ["asset", "asset/inline", "asset/resource"]) {
					normalModuleFactory.hooks.createGenerator
						.for(type)
						// eslint-disable-next-line no-loop-func
						.tap(plugin, generatorOptions => {
							validateGeneratorOptions[type](generatorOptions);

							let dataUrl = undefined;
							if (type !== "asset/resource") {
								dataUrl = generatorOptions.dataUrl;
								if (!dataUrl || typeof dataUrl === "object") {
									dataUrl = {
										encoding: undefined,
										mimetype: undefined,
										...dataUrl
									};
								}
							}

							let filename = undefined;
							let publicPath = undefined;
							if (type !== "asset/inline") {
								filename = generatorOptions.filename;
								publicPath = generatorOptions.publicPath;
							}

							const AssetGenerator = getAssetGenerator();

							return new AssetGenerator(
								dataUrl,
								filename,
								publicPath,
								generatorOptions.emit !== false
							);
						});
				}
				// 源码资源代码生成器
				normalModuleFactory.hooks.createGenerator
					.for("asset/source")
					.tap(plugin, () => {
						const AssetSourceGenerator = getAssetSourceGenerator();

						return new AssetSourceGenerator();
					});

				// 
				compilation.hooks.renderManifest.tap(plugin, (result, options) => {
					const { chunkGraph } = compilation;
					const { chunk, codeGenerationResults } = options;

					const modules = chunkGraph.getOrderedChunkModulesIterableBySourceType(
						chunk,
						"asset",
						compareModulesByIdentifier
					);
					if (modules) {
						for (const module of modules) {
							const codeGenResult = codeGenerationResults.get(
								module,
								chunk.runtime
							);
							result.push({
								render: () => codeGenResult.sources.get(type),
								filename:
									module.buildInfo.filename ||
									codeGenResult.data.get("filename"),
								info:
									module.buildInfo.assetInfo ||
									codeGenResult.data.get("assetInfo"),
								auxiliary: true,
								identifier: `assetModule${chunkGraph.getModuleId(module)}`,
								hash:
									module.buildInfo.fullContentHash ||
									codeGenResult.data.get("fullContentHash")
							});
						}
					}

					return result;
				});

				// 
				compilation.hooks.prepareModuleExecution.tap(
					"AssetModulesPlugin",
					(options, context) => {
						const { codeGenerationResult } = options;
						const source = codeGenerationResult.sources.get("asset");
						if (source === undefined) return;
						context.assets.set(codeGenerationResult.data.get("filename"), {
							source,
							info: codeGenerationResult.data.get("assetInfo")
						});
					}
				);
			}
		);
	}
}

module.exports = AssetModulesPlugin;
