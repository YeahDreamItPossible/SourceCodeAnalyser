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
