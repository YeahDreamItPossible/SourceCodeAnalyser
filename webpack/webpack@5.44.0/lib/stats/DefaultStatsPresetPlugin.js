"use strict";

const RequestShortener = require("../RequestShortener");

// 将 默认配置 合并到 用户自定义配置中
// 即: 将 default 合并到 options 中
const applyDefaults = (options, defaults) => {
	for (const key of Object.keys(defaults)) {
		if (typeof options[key] === "undefined") {
			options[key] = defaults[key];
		}
	}
};

// 默认预设 即 默认预设对应的配置信息
const NAMED_PRESETS = {
	verbose: {
		hash: true,
		builtAt: true,
		relatedAssets: true,
		entrypoints: true,
		chunkGroups: true,
		ids: true,
		modules: false,
		chunks: true,
		chunkRelations: true,
		chunkModules: true,
		dependentModules: true,
		chunkOrigins: true,
		depth: true,
		env: true,
		reasons: true,
		usedExports: true,
		providedExports: true,
		optimizationBailout: true,
		errorDetails: true,
		errorStack: true,
		publicPath: true,
		logging: "verbose",
		orphanModules: true,
		runtimeModules: true,
		exclude: false,
		modulesSpace: Infinity,
		chunkModulesSpace: Infinity,
		assetsSpace: Infinity,
		children: true
	},
	detailed: {
		hash: true,
		builtAt: true,
		relatedAssets: true,
		entrypoints: true,
		chunkGroups: true,
		ids: true,
		chunks: true,
		chunkRelations: true,
		chunkModules: false,
		chunkOrigins: true,
		depth: true,
		usedExports: true,
		providedExports: true,
		optimizationBailout: true,
		errorDetails: true,
		publicPath: true,
		logging: true,
		runtimeModules: true,
		exclude: false,
		modulesSpace: Infinity,
		assetsSpace: Infinity
	},
	minimal: {
		all: false,
		version: true,
		timings: true,
		modules: true,
		modulesSpace: 0,
		assets: true,
		assetsSpace: 0,
		errors: true,
		errorsCount: true,
		warnings: true,
		warningsCount: true,
		logging: "warn"
	},
	"errors-only": {
		all: false,
		errors: true,
		errorsCount: true,
		moduleTrace: true,
		logging: "error"
	},
	"errors-warnings": {
		all: false,
		errors: true,
		errorsCount: true,
		warnings: true,
		warningsCount: true,
		logging: "warn"
	},
	summary: {
		all: false,
		version: true,
		errorsCount: true,
		warningsCount: true
	},
	none: {
		all: false
	}
};

// 规则
const NORMAL_ON = ({ all }) => all !== false;
const NORMAL_OFF = ({ all }) => all === true;
const ON_FOR_TO_STRING = ({ all }, { forToString }) =>
	forToString ? all !== false : all === true;
const OFF_FOR_TO_STRING = ({ all }, { forToString }) =>
	forToString ? all === true : all !== false;
const AUTO_FOR_TO_STRING = ({ all }, { forToString }) => {
	if (all === false) return false;
	if (all === true) return true;
	if (forToString) return "auto";
	return true;
};

// 默认配置
const DEFAULTS = {
	context: (options, context, compilation) => compilation.compiler.context,
	requestShortener: (options, context, compilation) =>
		compilation.compiler.context === options.context
			? compilation.requestShortener
			: new RequestShortener(options.context, compilation.compiler.root),
	performance: NORMAL_ON,
	hash: OFF_FOR_TO_STRING,
	env: NORMAL_OFF,
	version: NORMAL_ON,
	timings: NORMAL_ON,
	builtAt: OFF_FOR_TO_STRING,
	assets: NORMAL_ON,
	entrypoints: AUTO_FOR_TO_STRING,
	chunkGroups: OFF_FOR_TO_STRING,
	chunkGroupAuxiliary: OFF_FOR_TO_STRING,
	chunkGroupChildren: OFF_FOR_TO_STRING,
	chunkGroupMaxAssets: (o, { forToString }) => (forToString ? 5 : Infinity),
	chunks: OFF_FOR_TO_STRING,
	chunkRelations: OFF_FOR_TO_STRING,
	chunkModules: ({ all, modules }) => {
		if (all === false) return false;
		if (all === true) return true;
		if (modules) return false;
		return true;
	},
	dependentModules: OFF_FOR_TO_STRING,
	chunkOrigins: OFF_FOR_TO_STRING,
	ids: OFF_FOR_TO_STRING,
	modules: ({ all, chunks, chunkModules }, { forToString }) => {
		if (all === false) return false;
		if (all === true) return true;
		if (forToString && chunks && chunkModules) return false;
		return true;
	},
	nestedModules: OFF_FOR_TO_STRING,
	groupModulesByType: ON_FOR_TO_STRING,
	groupModulesByCacheStatus: ON_FOR_TO_STRING,
	groupModulesByLayer: ON_FOR_TO_STRING,
	groupModulesByAttributes: ON_FOR_TO_STRING,
	groupModulesByPath: ON_FOR_TO_STRING,
	groupModulesByExtension: ON_FOR_TO_STRING,
	modulesSpace: (o, { forToString }) => (forToString ? 15 : Infinity),
	chunkModulesSpace: (o, { forToString }) => (forToString ? 10 : Infinity),
	nestedModulesSpace: (o, { forToString }) => (forToString ? 10 : Infinity),
	relatedAssets: OFF_FOR_TO_STRING,
	groupAssetsByEmitStatus: ON_FOR_TO_STRING,
	groupAssetsByInfo: ON_FOR_TO_STRING,
	groupAssetsByPath: ON_FOR_TO_STRING,
	groupAssetsByExtension: ON_FOR_TO_STRING,
	groupAssetsByChunk: ON_FOR_TO_STRING,
	assetsSpace: (o, { forToString }) => (forToString ? 15 : Infinity),
	orphanModules: OFF_FOR_TO_STRING,
	runtimeModules: ({ all, runtime }, { forToString }) =>
		runtime !== undefined
			? runtime
			: forToString
			? all === true
			: all !== false,
	cachedModules: ({ all, cached }, { forToString }) =>
		cached !== undefined ? cached : forToString ? all === true : all !== false,
	moduleAssets: OFF_FOR_TO_STRING,
	depth: OFF_FOR_TO_STRING,
	cachedAssets: OFF_FOR_TO_STRING,
	reasons: OFF_FOR_TO_STRING,
	usedExports: OFF_FOR_TO_STRING,
	providedExports: OFF_FOR_TO_STRING,
	optimizationBailout: OFF_FOR_TO_STRING,
	children: OFF_FOR_TO_STRING,
	source: NORMAL_OFF,
	moduleTrace: NORMAL_ON,
	errors: NORMAL_ON,
	errorsCount: NORMAL_ON,
	errorDetails: AUTO_FOR_TO_STRING,
	errorStack: OFF_FOR_TO_STRING,
	warnings: NORMAL_ON,
	warningsCount: NORMAL_ON,
	publicPath: OFF_FOR_TO_STRING,
	logging: ({ all }, { forToString }) =>
		forToString && all !== false ? "info" : false,
	loggingDebug: () => [],
	loggingTrace: OFF_FOR_TO_STRING,
	excludeModules: () => [],
	excludeAssets: () => [],
	modulesSort: () => "depth",
	chunkModulesSort: () => "name",
	nestedModulesSort: () => false,
	chunksSort: () => false,
	assetsSort: () => "!size",
	outputPath: OFF_FOR_TO_STRING,
	colors: () => false
};

const normalizeFilter = item => {
	if (typeof item === "string") {
		const regExp = new RegExp(
			`[\\\\/]${item.replace(
				// eslint-disable-next-line no-useless-escape
				/[-[\]{}()*+?.\\^$|]/g,
				"\\$&"
			)}([\\\\/]|$|!|\\?)`
		);
		return ident => regExp.test(ident);
	}
	if (item && typeof item === "object" && typeof item.test === "function") {
		return ident => item.test(ident);
	}
	if (typeof item === "function") {
		return item;
	}
	if (typeof item === "boolean") {
		return () => item;
	}
};

// 默认配置
const NORMALIZER = {
	excludeModules: value => {
		if (!Array.isArray(value)) {
			value = value ? [value] : [];
		}
		return value.map(normalizeFilter);
	},
	excludeAssets: value => {
		if (!Array.isArray(value)) {
			value = value ? [value] : [];
		}
		return value.map(normalizeFilter);
	},
	warningsFilter: value => {
		if (!Array.isArray(value)) {
			value = value ? [value] : [];
		}
		return value.map(filter => {
			if (typeof filter === "string") {
				return (warning, warningString) => warningString.includes(filter);
			}
			if (filter instanceof RegExp) {
				return (warning, warningString) => filter.test(warningString);
			}
			if (typeof filter === "function") {
				return filter;
			}
			throw new Error(
				`Can only filter warnings with Strings or RegExps. (Given: ${filter})`
			);
		});
	},
	logging: value => {
		if (value === true) value = "log";
		return value;
	},
	loggingDebug: value => {
		if (!Array.isArray(value)) {
			value = value ? [value] : [];
		}
		return value.map(normalizeFilter);
	}
};

/**
 * 对 Webpack.options.stats 值 进行加工处理
 * 1. 如果 Webpack.options.stats = 'String' 表示预设(preset)
 * 		每种预设(preset) 都对应着某种默认详细配置
 * 2. 如果 Webpack.options.stats = 'Object' 表示用户自定义详细配置
 */
// 针对 Webpack.options.stats 字段注册插件
// 将 默认配置 合并到 用户自定义配置中
// 1. 先将 默认预设中的默认配置 合并到 用户自定义配置中
// 2. 再将 特殊的默认配置 合并到 用户自定义配置中
class DefaultStatsPresetPlugin {
	apply(compiler) {
		compiler.hooks.compilation.tap("DefaultStatsPresetPlugin", compilation => {
			for (const key of Object.keys(NAMED_PRESETS)) {
				const defaults = NAMED_PRESETS[key];
				// 应用各种预设 并将各种预设对应的配置 合并到用户自定义配置中
				compilation.hooks.statsPreset
					.for(key)
					.tap("DefaultStatsPresetPlugin", (options, context) => {
						// 将默认预设 defaults 合并到用户自定义预设 options 中
						applyDefaults(options, defaults);
					});
			}

			// 将默认配种 合并到 用户自定义配置中
			compilation.hooks.statsNormalize.tap(
				"DefaultStatsPresetPlugin",
				(options, context) => {
					// 将默认配置 DEFAULTS 和 NORMALIZER 合并到用足自定义配置 options 中
					for (const key of Object.keys(DEFAULTS)) {
						if (options[key] === undefined)
							options[key] = DEFAULTS[key](options, context, compilation);
					}
					for (const key of Object.keys(NORMALIZER)) {
						options[key] = NORMALIZER[key](options[key]);
					}
				}
			);
		});
	}
}
module.exports = DefaultStatsPresetPlugin;
