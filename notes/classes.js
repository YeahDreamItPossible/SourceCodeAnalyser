class OptionsApply {
  process(options, compiler) {}
}

/**
 * 根据不同的options注册不同的插件
 */
class WebpackOptionsApply extends OptionsApply {
  process(options, compiler) {}
}

class WebpackPlugin {
  apply(compiler) {}
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

class ModuleFactory {
  create(data, callback) {}
}


// dependency
class Dependency {}
class EntryDependency extends Dependency {}

// module
class DependenciesBlock {}
class Module extends DependenciesBlock {}

class NormalModule extends Module {}
class ContextModule extends Module {}

/**
 * 1. create NormalModule 
 * 2. loaders
 * 3. parsers
 * 4. generators
*/
// parsers: 
// javascript/auto =>
// javascript/esm  =>
// javascript/dynamic => JavascriptParser

class NormalModuleFactory extends ModuleFactory {}
// 
class ContextModuleFactory extends ModuleFactory {}

// parser
class Parser {}
class JavascriptParser extends Parser {}

// generator
class Generator {}
class ByTypeGenerator extends Generator {}
class JavascriptGenerator extends Generator {}

// resolveFactory
