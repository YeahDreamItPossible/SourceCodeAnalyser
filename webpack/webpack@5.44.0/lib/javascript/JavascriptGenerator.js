"use strict";

const util = require("util");
const { RawSource, ReplaceSource } = require("webpack-sources");
const Generator = require("../Generator");
const InitFragment = require("../InitFragment");
const HarmonyCompatibilityDependency = require("../dependencies/HarmonyCompatibilityDependency");

const deprecatedGetInitFragments = util.deprecate(
	(template, dependency, templateContext) =>
		template.getInitFragments(dependency, templateContext),
	"DependencyTemplate.getInitFragment is deprecated (use apply(dep, source, { initFragments }) instead)",
	"DEP_WEBPACK_JAVASCRIPT_GENERATOR_GET_INIT_FRAGMENTS"
);

const TYPES = new Set(["javascript"]);

// JS类型 代码生成器
// 作用:
// 
class JavascriptGenerator extends Generator {
	// 返回当前生成器类型
	getTypes(module) {
		return TYPES;
	}

	// 返回模块大小
	getSize(module, type) {
		const originalSource = module.originalSource();
		if (!originalSource) {
			return 39;
		}
		return originalSource.size();
	}

	// 返回此模块无法被链接的原因
	// 当此模块可以被连接时 返回undefined
	getConcatenationBailoutReason(module, context) {
		// Only harmony modules are valid for optimization
		if (
			!module.buildMeta ||
			module.buildMeta.exportsType !== "namespace" ||
			module.presentationalDependencies === undefined ||
			!module.presentationalDependencies.some(
				d => d instanceof HarmonyCompatibilityDependency
			)
		) {
			return "Module is not an ECMAScript module";
		}

		// Some expressions are not compatible with module concatenation
		// because they may produce unexpected results. The plugin bails out
		// if some were detected upfront.
		if (module.buildInfo && module.buildInfo.moduleConcatenationBailout) {
			return `Module uses ${module.buildInfo.moduleConcatenationBailout}`;
		}
	}

	// 生成代码
	generate(module, generateContext) {
		const originalSource = module.originalSource();
		if (!originalSource) {
			return new RawSource("throw new Error('No source available');");
		}

		const source = new ReplaceSource(originalSource);
		const initFragments = [];

		this.sourceModule(module, initFragments, source, generateContext);

		return InitFragment.addToSource(source, initFragments, generateContext);
	}

	// 生成 模块代码
	// 1. 先生成 依赖代码
	// 2. 再生成 异步模块代码
	sourceModule(module, initFragments, source, generateContext) {
		for (const dependency of module.dependencies) {
			this.sourceDependency(
				module,
				dependency,
				initFragments,
				source,
				generateContext
			);
		}

		if (module.presentationalDependencies !== undefined) {
			for (const dependency of module.presentationalDependencies) {
				this.sourceDependency(
					module,
					dependency,
					initFragments,
					source,
					generateContext
				);
			}
		}

		for (const childBlock of module.blocks) {
			this.sourceBlock(
				module,
				childBlock,
				initFragments,
				source,
				generateContext
			);
		}
	}

	// 生成 异步模块代码
	sourceBlock(module, block, initFragments, source, generateContext) {
		for (const dependency of block.dependencies) {
			this.sourceDependency(
				module,
				dependency,
				initFragments,
				source,
				generateContext
			);
		}

		for (const childBlock of block.blocks) {
			this.sourceBlock(
				module,
				childBlock,
				initFragments,
				source,
				generateContext
			);
		}
	}

	// 生成 依赖代码
	sourceDependency(module, dependency, initFragments, source, generateContext) {
		const constructor = ( dependency.constructor );
		const template = generateContext.dependencyTemplates.get(constructor);
		if (!template) {
			throw new Error(
				"No template for dependency: " + dependency.constructor.name
			);
		}

		const templateContext = {
			runtimeTemplate: generateContext.runtimeTemplate,
			dependencyTemplates: generateContext.dependencyTemplates,
			moduleGraph: generateContext.moduleGraph,
			chunkGraph: generateContext.chunkGraph,
			module,
			runtime: generateContext.runtime,
			runtimeRequirements: generateContext.runtimeRequirements,
			concatenationScope: generateContext.concatenationScope,
			initFragments
		};

		// 调用 依赖 对应的 依赖模板 方法 对 source 进行处理
		// dependencyTemplate.apply
		template.apply(dependency, source, templateContext);

		// TODO remove in webpack 6
		if ("getInitFragments" in template) {
			const fragments = deprecatedGetInitFragments(
				template,
				dependency,
				templateContext
			);

			if (fragments) {
				for (const fragment of fragments) {
					initFragments.push(fragment);
				}
			}
		}
	}
}

module.exports = JavascriptGenerator;
