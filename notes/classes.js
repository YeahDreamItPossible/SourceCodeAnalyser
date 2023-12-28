// webpack plugin
class WebpackPlugin {
  apply(compiler) {}
}

// /lib/asset
// 注册插件
// normalModuleFactory.hooks.createParser
// normalModuleFactory.hooks.createGenerator
// compilation.hooks.renderManifest
// compilation.hooks.prepareModuleExecution
class AssetModulesPlugin extends WebpackPlugin {}
// 根据资源路径获取解析后的资源 并标识模块类型
// module.buildInfo.strict = true
// module.buildMeta.exportsType = "default"
// module.buildInfo.dataUrl = Boolean || Object || Function
// 资源模块: 主要用解析webpack.options.modules.rules[x].type = 'asset' || 'asset/inline' || 'asset/resource'
class AssetParser extends Parser {}
// 根据资源路径获取解析后的资源 并标识模块类型
// module.buildInfo.strict = true
// module.buildMeta.exportsType = "default"
// 资源模块: 主要用解析webpack.options.modules.rules[x].type = 'asset/source'
class AssetSourceParser extends Parser {}
// 生成代码, 主要是生成WebpackSource实例
// 资源模块: 主要用生成webpack.options.modules.rules[x].type = 'asset' || 'asset/inline' || 'asset/resource'
//
class AssetGenerator extends Generator {}
// 生成代码, 主要是生成WebpackSource实例
// 资源模块: 主要用生成webpack.options.modules.rules[x].type = 'asset/source'
class AssetSourceGenerator extends Generator {}

// /lib/async-modules
// 生成代码片段
class AwaitDependenciesInitFragment extends InitFragment {}
// 标识 module所对应的ModuleGraphModule.async = true
// compilation.hooks.finishModules
class InferAsyncModulesPlugin extends WebpackPlugin {}

// /lib/cache
// 
class AddBuildDependenciesPlugin extends WebpackPlugin {}
//
class AddManagedPathsPlugin extends WebpackPlugin {}
//
class IdleFileCachePlugin extends WebpackPlugin {}
// 
class MemoryCachePlugin extends WebpackPlugin {}
//
class MemeoryWithGcCachePlugin extends WebpackPlugin {}
// 
class PackFileCacheStrategy {}
// 
class ResolverCachePlugin extends WebpackPlugin {}

class OptionsApply {
  process(options, compiler) {}
}

// 根据不同的options注册不同的插件
class WebpackOptionsApply extends OptionsApply {
  process(options, compiler) {}
}



/**
 * 主要是排除 以cdn方式引入的依赖
 * 内部调用 ExternalModuleFactoryPlugin
 */
class ExternalsPlugin extends WebpackPlugin {
}
/**
 * 主要是给normalModuleFactory.hooks.factorize注册插件
 */
class ExternalModuleFactoryPlugin extends WebpackPlugin {}


