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
		buildModule
		normalModuleLoader
		succeedModule
		...(循环 buildModule normalModuleLoader succeedModule)
finishMake
		log
		finishModules
		log
		seal                    // 主要是收集errors 和 warnings
		optimizeDependencies    // 仍然是收集errors 和 warnings
		log
		afterOptimizeDependencies   // 空调用
		log
		beforeChunks            // 空调用
		log
		afterChunks             // 空调用 (在beforeChunks 和 afterChunks 完成 chunks)
		log
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
		log
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
		log
		beforeModuleHash
		log
		afterModuleHash
		log
		beforeCodeGeneration
		log
		afterCodeGeneration
		log
		beforeRuntimeRequirements
		additionalModuleRuntimeRequirements
		...
		additionalTreeRuntimeRequirements
		runtimeModule
		afterRuntimeRequirements
		log
		beforeHash
		log
		log
		chunkHash
		contentHash
		log
		log
		fullHash
		log
		log
		afterHash
		log
		log
		recordHash
		log
		beforeModuleAssets
		log
		shouldGenerateChunkAssets
		beforeChunkAssets
		renderManifest
		assetPath
		chunkAsset
		log
		optimizeAssets
		processAssets
		afterOptimizeAssets
		afterProcessAssets
		log
		record
		needAdditionalSeal
		afterSeal
		log
		...
		log
afterCompile    // 直接执行回调
		log
shouldEmit      // 空调用
emit            // 直接执行回调 此回调函数中 创建目标目录 并输出结果
		assetPath
assetEmitted    // 输出每个文件后
afterEmit       // 直接执行回调
		log
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

/*
* 创建ModuleTree
*		factorize module (根据 resource path 构建module, 并缓存 resovler parser generator)
*			add module (缓存module)
*				build module
*					process moduleDependencies
*/


// Relation

// Dependency 位置信息

Module => DependenciesBlock => Dependency => AsyncDependenciesBlock => DependenciesBlock => Dependency