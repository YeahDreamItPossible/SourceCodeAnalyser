"use strict";

const { ConcatSource } = require("webpack-sources");
const Compilation = require("./Compilation");
const ModuleFilenameHelpers = require("./ModuleFilenameHelpers");
const Template = require("./Template");
const createSchemaValidation = require("./util/create-schema-validation");

// 验证选项
const validate = createSchemaValidation(
	require("../schemas/plugins/BannerPlugin.check.js"),
	() => require("../schemas/plugins/BannerPlugin.json"),
	{
		name: "Banner Plugin",
		baseDataPath: "options"
	}
);

// 将字符串包装成单行注释
const wrapComment = str => {
	if (!str.includes("\n")) {
		return Template.toComment(str);
	}
	return `/*!\n * ${str
		.replace(/\*\//g, "* /")
		.split("\n")
		.join("\n * ")
		.replace(/\s+\n/g, "\n")
		.trimRight()}\n */`;
};

// 给满足条件的chunk文件头部或者尾部添加banner注释
class BannerPlugin {
	constructor(options) {
		if (typeof options === "string" || typeof options === "function") {
			options = {
				banner: options
			};
		}

		validate(options);

		// options.raw  如果值为 true，将直接输出，不会被作为注释
		// options.banner 该值为字符串或函数，将作为注释存在
		// options.entryOnly 如果值为 true，将只在入口 chunks 文件中添加
		// options.test 包含所有匹配的模块
		// options.include 根据条件匹配所有模块
		// options.exclude 根据条件排除所有模块
		// footer 如果值为 true，banner 将会位于编译结果的最下方
		this.options = options;
		const bannerOption = options.banner;
		// options.raw 如果值为 true，将直接输出，不会被作为注释
		if (typeof bannerOption === "function") {
			const getBanner = bannerOption;
			this.banner = this.options.raw
				? getBanner
				: data => wrapComment(getBanner(data));
		} else {
			const banner = this.options.raw
				? bannerOption
				: wrapComment(bannerOption);
			this.banner = () => banner;
		}
	}

	apply(compiler) {
		const options = this.options;
		const banner = this.banner;
		const matchObject = ModuleFilenameHelpers.matchObject.bind(
			undefined,
			options
		);

		compiler.hooks.compilation.tap("BannerPlugin", compilation => {
			compilation.hooks.processAssets.tap(
				{
					name: "BannerPlugin",
					stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
				},
				() => {
					for (const chunk of compilation.chunks) {
						if (options.entryOnly && !chunk.canBeInitial()) {
							continue;
						}

						for (const file of chunk.files) {
							if (!matchObject(file)) {
								continue;
							}

							const data = {
								chunk,
								filename: file
							};

							const comment = compilation.getPath(banner, data);

							compilation.updateAsset(
								file,
								old => new ConcatSource(comment, "\n", old)
							);
						}
					}
				}
			);
		});
	}
}

module.exports = BannerPlugin;
