const compilerHooks = `
// 空调用(此时已经注册完用户自定义插件)
environment()
// 空调用
afterEnvironment()

// WebpackOptionsApply(根据options根据不同的值 注册不同的内置插件)
// EntryOptionPlugin
entryOption(options.context, options.entry)
// 空调用(初始化内部插件后调用)
afterPlugins(compiler)
// ResolverFactory(用于解析路径)
afterResolvers(compiler)

// 空调用(此时已经根据选项注册完内置插件)
initialize()

// api: compiler.run
// NodeEnvironmentPlugin
// 标识compiler开始
beforeRun(compiler)

// 直接执行回调
run(compiler) 

// api: compiler.createNormalModuleFactory
// 当创建 NormalModuleFactory 实例后
normalModuleFactory(normalModuleFactory)

// api: compiler.createContextModuleFactory
// 当创建 ContextModuleFactory 实例后
contextModuleFactory(contextModuleFactory)

// api: compiler.compile
// 直接执行回调
beforeCompile(params)
// ExternalsPlugin
// 主要时 从输出的bundle排除依赖(该依赖通过cdn 或者别的方式 以什么样的方式 引入)
compile(params)

// api: compiler.newCompilation
// 主要是给 compilation hooks 不同 hook 注册函数
thisCompilation(compilation, params)
// 主要是给 compilation hooks 不同 hook 注册函数  
compilation(compilation, params)

// api: compiler.compile
// EntryPlugin
// 添加入口 开始编译(主要是调用compilation.addEntry)
make(compilation)
// 直接执行回调
finishMake(compilation)
// 直接执行回调 
afterCompile(compilation)

// api: compiler.run
// 空调用
shouldEmit

// api: compiler.emitAssets(创建目录 并写入文件)
// 直接执行回调(此回调函数中 创建目标目录 并输出结果)
emit(compilation)
// 输出每个文件后
assetEmitted(file, {}) 
// 直接执行回调(所有的文件都被输出后)
afterEmit(compilation)

// 空调用
needAdditionalPass()

// 
done(stats)
`