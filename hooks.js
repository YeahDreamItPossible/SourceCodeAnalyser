const hooks = `
environment                   // 空调用
afterEnvironment              // 空调用
entryOption
afterPlugins                  // 初始化内部插件后调用
afterResolvers                // 空调用
initialize                    // 空调用
beforeRun                     // 标识 compiler 开始 主要是调用 NodeEnvironmentPlugin 插件
run                           // 直接执行回调
normalModuleFactory           // 当创建 NormalModuleFactory 实例后
contextModuleFactory          // 当创建 ContextModuleFactory 实例后
beforeCompile                 // 直接执行回调
compile                       // 主要时 从输出的bundle排除依赖(该依赖通过cdn 或者别的方式 以什么样的方式 引入)
thisCompilation               // 主要是给 compilation hooks 不同 hook 注册函数
compilation                   // 主要是给 compilation hooks 不同 hook 注册函数
make                          // 添加入口 开始编译 主要是调用 compilation.addEntry
		addEntry                // 空调用 标记
		buildModule							// 空调用
		normalModuleLoader			// 废弃
		succeedModule						// 空调用
		...(循环 buildModule normalModuleLoader succeedModule)
finishMake
		finishModules
		seal                    // 主要是收集errors 和 warnings
		optimizeDependencies    // 仍然是收集errors 和 warnings
		afterOptimizeDependencies   // 空调用
		beforeChunks            // 空调用
		afterChunks             // 空调用 (在beforeChunks 和 afterChunks 完成 chunks)
		optimize                // 空调用
		optimizeModules         // 空调用
		afterOptimizeModules    // 空调用
		optimizeChunks          // 优化chunks
														// 串行调用插件 
														// EnsureChunkConditionsPlugin 
														// RemoveEmptyChunksPlugin 
														// MergeDuplicateChunksPlugin
														// SplitChunksPlugin
														// RemoveEmptyChunksPlugin
		afterOptimizeChunks     // 空调用
		optimizeTree            // 直接执行回调
		afterOptimizeTree       // 空调用
		optimizeChunkModules    // 直接执行回调
		afterOptimizeChunkModules   // 空调用
		shouldRecord            // 空调用
		reviveModules           // 空调用
		beforeModuleIds         // 空调用
		moduleIds               // 调用来每个模块分配一个 id(NamedModuleIdsPlugin)
		optimizeModuleIds       // 空调用
		afterOptimizeModuleIds  // 空调用
		reviveChunks
		beforeChunkIds
		chunkIds
		optimizeChunkIds
		afterOptimizeChunkIds
		recordModules
		recordChunks
		optimizeCodeGeneration
		beforeModuleHash
		afterModuleHash
		beforeCodeGeneration
		afterCodeGeneration
		beforeRuntimeRequirements
		additionalModuleRuntimeRequirements
		...
		additionalTreeRuntimeRequirements
		runtimeModule
		afterRuntimeRequirements
		beforeHash
		chunkHash
		contentHash
		fullHash
		afterHash
		recordHash
		beforeModuleAssets
		shouldGenerateChunkAssets
		beforeChunkAssets
		renderManifest
		assetPath
		chunkAsset
		optimizeAssets
		processAssets
		afterOptimizeAssets
		afterProcessAssets
		record
		needAdditionalSeal
		afterSeal
afterCompile    // 直接执行回调
shouldEmit      // 空调用
emit            // 直接执行回调 此回调函数中 创建目标目录 并输出结果
		assetPath
assetEmitted    // 输出每个文件后
afterEmit       // 直接执行回调
		needAdditionalPass
`;

const compilation = `
	addEntry(添加多个入口 如多页面应用)(入参: context entry options callback)
		_addEntryItem(依次添加单个入口)
			addModuleTree(根据 dep 找到对应 factory)
				handleModuleCreation(构建模块 该函数可递归调用)
					factorizeModule
						_factorizeModule
							addModule
								_addModule
									buildModule
										_buildModule
											processModuleDependencies
												_processModuleDependencies
					handleModuleCreation
						factorizeModule
							_factorizeModule
								...(递归解析)
	
	finish(缓存模块 并收集errors 和 warnings)

	seal

		codeGeneration
			_runCodeGenerationJobs
				_codeGenerationModule
				是为了获得 codeGenerationResults
			
				createHash
				_runCodeGenerationJobs
					clearAssets
					createModuleAssets
					createChunkAssets
						getRenderManifest
						getPathWithInfo
						emitAsset
`;

const compilerHooks = `
environment                   // 空调用
afterEnvironment              // 空调用
entryOption
afterPlugins                  // 初始化内部插件后调用
afterResolvers                // 空调用
initialize                    // 空调用
beforeRun                     // 标识 compiler 开始 主要是调用 NodeEnvironmentPlugin 插件
run                           // 直接执行回调
normalModuleFactory           // 当创建 NormalModuleFactory 实例后
contextModuleFactory          // 当创建 ContextModuleFactory 实例后
beforeCompile                 // 直接执行回调
compile                       // 主要时 从输出的bundle排除依赖(该依赖通过cdn 或者别的方式 以什么样的方式 引入)
thisCompilation               // 主要是给 compilation hooks 不同 hook 注册函数
compilation                   // 主要是给 compilation hooks 不同 hook 注册函数
make                          // 添加入口 开始编译 主要是调用 compilation.addEntry
afterCompile    // 直接执行回调
shouldEmit      // 空调用
emit            // 直接执行回调 此回调函数中 创建目标目录 并输出结果
assetEmitted    // 输出每个文件后
afterEmit       // 直接执行回调
finishMake
`

const compilationHooks = `
addEntry(空调用)
buildModule(空调用)(在module.needBuiild回调中调用 测试module仅仅只是构建)
normalModuleLoader(废弃)
  failedModule
succeedModule(空调用)(在module.build回调中调用 此时已经拿到_source)
...(循环 buildModule normalModuleLoader succeedModule)

finishModules(ResolverCachePlugin InferAsyncModulesPlugin FlagDependencyExportsPlugin)(compiler.finish中执行)
seal(WarnCaseSensitiveModulesPlugin 对模块路径小写后 判断是否有重复)(compiler.seal)

// 优化开始
optimizeDependencies(SideEffectsFlagPlugin)
afterOptimizeDependencies(空调用)

beforeChunks(空调用)
afterChunks(空调用 在beforeChunks 和 afterChunks 完成 chunks)

optimize(空调用)
optimizeModules(空调用)
afterOptimizeModules(空调用)

optimizeChunks()
afterOptimizeChunks(空调用)

optimizeTree(直接执行回调)
afterOptimizeTree(空调用)

optimizeChunkModules(直接执行回调)
afterOptimizeChunkModules(空调用)

// 串行调用插件
// 1. EnsureChunkConditionsPlugin
// 针对于ExternalModule FallbackModule模块
// 2. RemoveEmptyChunksPlugin
// 移除空的chunk
// 此chunk没有modules && 此chunk不是runtime chunk && 此chunk没有entry modules
// 3. MergeDuplicateChunksPlugin
// 4. SplitChunksPlugin
// 5. RemoveEmptyChunksPlugin
optimizeChunkModules
afterOptimizeChunkModules

optimizeTree(this.chunks, this.modules)(直接执行回调)
afterOptimizeTree(this.chunks, this.modules)(直接执行回调)

optimizeChunkModules(this.chunks, this.modules)(直接执行回调)
afterOptimizeChunkModules(this.chunks, this.modules)(直接执行回调)

shouldRecord(空调用)

// RecordIdsPlugin
// 从 record 中恢复模块信息

// 根据compilation.records.modules设置ChunkGraphModule.id
reviveModules(this.modules, this.records)

beforeModuleIds(this.modules)
// NamedModuleIdsPlugin
// TODO: 感觉主要作用是设置 ChunkGraphModule.id = module.xx
moduleIds(this.modules)

optimizeModuleIds(this.modules)(空调用)
afterOptimizeModuleIds(this.modules)(空调用)

// RecordIdsPlugin
// 根据compilation.records.chunks设置chunk.id chunk.ids
reviveChunks(this.chunks, this.records)

beforeChunkIds(this.chunks)(空调用)
// NamedChunkIdsPlugin
chunkIds(this.chunks)

optimizeChunkIds(this.chunks)(空调用)
afterOptimizeChunkIds(this.chunks)(空调用)

// 根据compilation.modules设置compilation.records.modules
recordModules(this.modules, this.records)
// 将compilation.chunks信息存储到compilation.records.chunks
recordChunks(this.chunks, this.records)

optimizeCodeGeneration()(空调用)

beforeModuleHash()(空调用)
afterModuleHash()(空调用)

beforeCodeGeneration()(空调用)
afterCodeGeneration()(空调用)

beforeRuntimeRequirements()(空调用)
afterRuntimeRequirements()(空调用)

beforeHash()(空调用)

// TODO:
chunkHash
contentHash
fullHash

afterHash()(空调用)

recordHash(this.records)(空调用)

beforeModuleAssets()(空调用)

shouldGenerateChunkAssets()(空调用)
beforeChunkAssets()(空调用)

// JavascriptModulesPlugin  获得render函数
// AssetModulesPlugin
renderManifest([], options)

assetPath
chunkAsset(chunk, file)(空调用)

optimizeAssets

processAssets(this.assets)(直接执行回调)
afterOptimizeAssets
afterProcessAssets(this.assets)(空调用)

record(this.records)(空调用)
needAdditionalSeal()(空调用)
afterSeal()(直接执行回调)


// 如果返回true 可用于生成 stats 默认空调用
needAdditionalPass()
`

const normalModuleFactoryHooks = `
beforeResolve(直接执行回调)
	factorize
		resolve(获取loaders)
			afterResolve(直接执行回调)
				createModule(直接执行回调, 创建 NormalModule)
					module(SideEffectsFlagPlugin)
					resolveForScheme
					createParser
					parser
					createGenerator
					generator
`

/**
* 创建ModuleTree
*		factorize module (根据 resource path 构建module, 并缓存 resovler parser generator)
*			add module (缓存module)
*				build module
*					process moduleDependencies
*/

/**
 * Dependency
 * 依赖
 * _parentModule Module
 * _parentDependenciesBlock DependenciesBlock
 * loc 位置信息
 */

/**
 * DependenciesBlock
 * 依赖分块
 * dependencies Array<Dependency>
 * blocks Array<AsyncDependenciesBlock>
 */

/**
 * AsyncDependenciesBlock extend DependenciesBlock
 * 
 * request
 */

/**
 * Module extend DependenciesBlock
 * 模块
 * type 类型
 * context 上下文
 * 
 * _resolveOptions resolver options
 * _warnings 警告
 * _errors 错误
 * 
 * buildMeta BuildMeta
 * buildInfo
 * 
 * ...资源请求路径(如: request rawQuest resource)
 * ...
 */

/**
 * Asset
 */

/**
 * 
 */

/**
 * ModuleGraph
 * 主要描述了依赖和模块以及模块之间的图谱关系
 * _moduleMap Map<Module, ModuleGraphModule>
 * _dependencyMap Map<Dependency, ModuleGraphConnection>
 * 	
 * ModuleGraphModule 
 * 	主要描述了模块与模块之间的关系 
 * 	1. 引用当前模块的父模块集合 
 * 	2. 当前模块引用的字模块集合
 * income
 * 	
 * ModuleGraphConnection 
 * 	描述了模块与依赖之间的关系 
 * 	以依赖为主 
 * 	引用当前依赖的模块 
 * 	引用当前依赖的模块的父模块
 * module 当前module
 * resolvedModule 加工后的当前module
 * originModule 引用当前module的module
 * dependency 当前module的依赖
 * resolvedOriginModule 加工后的引用当前module的module
 */

/**
 * Chunk
 * _groups Set<ChunkGroup>
 * filenameTemplate output.filename
 */

/**
 * ChunkGroup
 * chunks Array<Chunk>
 * origins Array<OriginRecord>
 * _children Set<ChunkGroup> 存放子ChunkGroup
 * _parents Set<ChunkGroup> 存放父ChunkGroup
 * _asyncEntrypoints Set<ChunkGroup> 存放异步Entrypoint
 */

/**
 * Entrypoint extend ChunkGroup
 * _runtimeChunk Chunk
 * _entrypointChunk Chunk
 */

/**
 * ChunkGraphModule
 * 主要描述了当前module属于哪些chunk的
 * chunks Set<Chunk>
 * entryInChunks Set<Chunk>
 * runtimeInChunks Set<Chunk>
 * 
 * ChunkGraphChunk
 * 主要描述了当前chunk中有哪些modules的
 * modules Set<Module>
 * entryModules Map<Module, Entrypoint>
 * runtimeModules Set<RuntimeModule>
 * 
 * ChunkGraph
 * _modules WeakMap<Module, ChunkGraphModule>
 * _chunks  WeakMap<Chunk, ChunkGraphChunk>
 * _blockChunkGroups WeakMap<AsyncDependenciesBlock, ChunkGroup>
 */

// Relation

// Dependency 位置信息

Module => DependenciesBlock => Dependency => AsyncDependenciesBlock => DependenciesBlock => Dependency

// 初始化代码片段
InitFragment
// 
InitFragment => HarmonyExportInitFragment
InitFragment => AwaitDependenciesInitFragment
InitFragment => ModuleExternalInitFragment
InitFragment => ConditionalInitFragment


// 文件的输出是在compiler 发生的
// compilation 仅仅是生成 asserts 信息 并不输出结果

// 依赖
Dependency
// 
Dependency => LazyCompilationDependency
Dependency => ProvideSharedDependency
Dependency => DllEntryDependency
// 上下文依赖
Dependency => ContextDependency
Dependency => FallbackDependency
Dependency => ContainerEntryDependency
// 空以来
Dependency => NullDependency
// 

Dependency => NullDependency => CommonJsSelfReferenceDependency 
// 模块装饰依赖
Dependency => NullDependency => ModuleDecoratorDependency 
// 
Dependency => NullDependency => ModuleDecoratorDependency 
// ES模块导出标识符依赖
Dependency => NullDependency => HarmonyExportSpecifierDependency 
// ES模块导出默认值依赖
Dependency => NullDependency => HarmonyExportExpressionDependency 
// ES模块兼容性依赖
Dependency => NullDependency => HarmonyCompatibilityDependency 
// ES模块导出头依赖
Dependency => NullDependency => HarmonyExportHeaderDependency 
// 常量依赖
Dependency => NullDependency => ConstDependency 
// 缓存的常量依赖
Dependency => NullDependency => CachedConstDependency 
// 模块依赖
Dependency => ModuleDependency
// 工作线程依赖(当代码片段中含有 new Worker())
Dependency => ModuleDependency => WorkerDependency
// URL依赖(当代码片段中含有 new URL())
Dependency => ModuleDependency => URLDependency
// 入口依赖
Dependency => ModuleDependency => EntryDependency 
// ES模块导入依赖
Dependency => ModuleDependency => HarmonyImportDependency
// ES模块导入副作用依赖
Dependency => ModuleDependency => HarmonyImportDependency => HarmonyImportSideEffectDependency
// ES模块导入标识符依赖
Dependency => ModuleDependency => HarmonyImportDependency => HarmonyImportSpecifierDependency 
// ES模块复合导出导入标识符依赖
// export * from '...'
Dependency => ModuleDependency => HarmonyImportDependency => HarmonyExportImportedSpecifierDependency 
// ES模块动态导入依赖
Dependency => ModuleDependency => ImportDependency 
// ES模块动态导入立即加载依赖
// 动态导入 且 内敛注释 webpackMode = eager
Dependency => ModuleDependency => ImportDependency => ImportEagerDependency 
// ES模块动态导入弱引用加载依赖
// 动态导入 且 内敛注释 webpackMode = weak
Dependency => ModuleDependency => ImportDependency => ImportWeakDependency 
// 
Dependency => ModuleDependency => HarmonyImportDependency => HarmonyAcceptImportDependency 
Dependency => ModuleDependency => AMDRequireItemDependency 
Dependency => ModuleDependency => CommonJsRequireDependency 
Dependency => ModuleDependency => CommonJsFullRequireDependency 
Dependency => ModuleDependency => RequireResolveDependency 
Dependency => ModuleDependency => CommonJsExportRequireDependency 
Dependency => ModuleDependency => LoaderDependency 
Dependency => ModuleDependency => LoaderImportDependency 
Dependency => ModuleDependency => WebpackIsIncludedDependency 
Dependency => ModuleDependency => RequireIncludeDependency 
Dependency => ModuleDependency => RequireEnsureItemDependency 
// 
Dependency => ModuleDependency => ContextElementDependency 
// URL
Dependency => ModuleDependency => URLDependency
// 上下文依赖
Dependency => ContextDependency
// 动态导入 且导入路径包含动态表达式
Dependency => ContextDependency => ImportContextDependency
// 
Dependency => ContextDependency => AMDRequireContextDependency 
Dependency => ContextDependency => CommonJsRequireContextDependency 
Dependency => ContextDependency => RequireResolveContextDependency 
Dependency => ContextDependency => RequireContextDependency 

resolver  路径解析器
parser    语法分析器(语法解析器)
generator 代码生成器

// 依赖块
DependenciesBlock
// 异步依赖块(异步模块)
DependenciesBlock => AsyncDependenciesBlock
// CommonJS 异步模块
DependenciesBlock => AsyncDependenciesBlock => RequireEnsureDependenciesBlock
// AMD 异步模块
DependenciesBlock => AsyncDependenciesBlock => AMDRequireDependenciesBlock
// 模块
DependenciesBlock => Module
// 标准模块
DependenciesBlock => Module => NormalModule
// 原始模块
DependenciesBlock => Module => RawModule
// 运行时模块
DependenciesBlock => Module => RuntimeModule
// 
DependenciesBlock => Module => RuntimeModule => HasOwnPropertyRuntimeModule
//
DependenciesBlock => Module => RuntimeModule => AutoPublicPathRuntimeModule
//
DependenciesBlock => Module => RuntimeModule => ChunkNameRuntimeModule
//
DependenciesBlock => Module => RuntimeModule => CompatRuntimeModule
//
DependenciesBlock => Module => RuntimeModule => EnsureChunkRuntimeModule
//
DependenciesBlock => Module => RuntimeModule => HelperRuntimeModule
// 
DependenciesBlock => Module => RuntimeModule => GlobalRuntimeModule
//
DependenciesBlock => Module => RuntimeModule => HelperRuntimeModule => AsyncModuleRuntimeModule
// 上下文模块
DependenciesBlock => Module => ContextModule
// 动态链接库模块(与 DllPlugin 相关)
DependenciesBlock => Module => DllModule
// 外部扩展模块
DependenciesBlock => Module => ExternalModule
// 回退模块(与 模块联邦 相关)
DependenciesBlock => Module => FallbackModule

// 模块工厂
ModuleFactory
// 标准模块工厂
ModuleFactory => NormalModuleFactory
// 上下文模块工厂
ModuleFactory => ContextModuleFactory
// 动态模块工厂
ModuleFactory => DllModuleFactory
// 回退模块工厂(与 模块联邦 相关)
ModuleFactory => FallbackModuleFactory
// 
ModuleFactory => IgnoreErrorModuleFactory
// 
ModuleFactory => ProvideSharedModuleFactory


dependency module chunk assets bundle stats


总结:
1. source map 整个流程 和 debug 时能定位对应的行列 是什么原理
2. webpack-dev-server 与 webpack-dev-middleware 区别
3. optimization.moduleIds 与 optimization.chunkIds 到底对hash有什么作用


1. webpack 是如何解析 入口的 (动态入口 及 静态入口)
2. webpack 是如何解析模块方法的(esm cjs amd)
