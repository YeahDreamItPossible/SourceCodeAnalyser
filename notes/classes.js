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
// 添加打包依赖
// compilation.buildDependencies
class AddBuildDependenciesPlugin extends WebpackPlugin {}
// 添加路径
// compiler.managedPaths
// compiler.immutablePaths
class AddManagedPathsPlugin extends WebpackPlugin {}
// 缓存 webpack.options.cache.type = 'filesyste'
class IdleFileCachePlugin extends WebpackPlugin {}
// 缓存 webpack.options.cache.type = 'memory'
class MemoryCachePlugin extends WebpackPlugin {}
// 缓存 webpack.options.cache.type = 'memory'
class MemeoryWithGcCachePlugin extends WebpackPlugin {}
// 
class PackFileCacheStrategy {}
// NOTE: 感觉没啥用
class ResolverCachePlugin extends WebpackPlugin {}

// /lib/config
// webpack.options
// 1. 应用默认选项
// 2. normalize选项

// /lib/container
// 该目录的类主要用于模块联邦
// 
class ContainerEntryDependency extends Dependency {}
//
class ContainerEntryModule extends Module {}
//
class ContainerEntryModuleFactory extends ModuleFactory {}
//
class ContainerExposeDependency extends ModuleDependency {}
//
class ContainerPlugin extends WebpackPlugin {}
// 
class ContainerReferencePlugin extends WebpackPlugin {}
//
class FallbackDependency extends Dependency {}
//
class FallbackItemDependency extends Dependency {}
//
class FallbackModule extends Module {}
//
class FallbackModuleFactory extends ModuleFactory {}
//
class ModuleFederationPlugin extends WebpackPlugin {}
// 
class RemoteModule extends Module {}
//
class RemoteRuntimeModule extends RuntimeModule {}
//
class RemoteToExternalDependency extends ModuleDependency {}

// /lib/debug
//
class ProfilePlugin extends WebpackPlugin {}

// /lib/dependencies
// 依赖

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


