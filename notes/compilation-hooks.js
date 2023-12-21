const compilationHooks = `
// api: compilation._addEntryItem
// 空调用
addEntry(entry, options)

buildModule(空调用)(在module.needBuiild回调中调用 测试module仅仅只是构建)
normalModuleLoader(废弃)
  failedModule
succeedModule(空调用)(在module.build回调中调用 此时已经拿到_source)
...(循环 buildModule normalModuleLoader succeedModule)

// api: compilation._addEntryItem
succeedEntry(entry, options, module)

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