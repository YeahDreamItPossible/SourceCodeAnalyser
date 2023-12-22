// parser
class Parser {}
class JavascriptParser extends Parser {}

// generator
class Generator {}
class ByTypeGenerator extends Generator {}
class JavascriptGenerator extends Generator {}

// resolveFactory
// resolvers: (经常在moduleFactory.create产生)
// normal => new ResolverFactory()
// context => new ResolverFactory()
// loader => new ResolverFactory()
class ResolverFactory {}

class ModuleFactory {
  create(data, callback) {}
}

/**
 * 1. create NormalModule 
 * 2. loaders
 * 3. parsers
 * 4. generators
*/
// parsers: 
// 1. javascript/JavascriptModulesPlugin
// javascript/auto => new JavascriptParser("auto")
// javascript/esm  => new JavascriptParser("module")
// javascript/dynamic => new JavascriptParser("script")
// 2. asset/AssetModulesPlugin
// asset => new AssetParser(dataUrlCondition)
// asset/inline => new AssetParser(true)
// asset/resource => new AssetParser(false)
// asset/source => new AssetSourceParser()
// 3. json/JsonModulesPlugin
// json => new JsonParser(parserOptions)
// 4. wasm-async/AsyncWebAssemblyModulesPlugin
// webassembly/async => new AsyncWebAssemblyParser()
// 5. wasm-sync/WebAssemblyModulesPlugin
// webassembly/sync => new WebAssemblyParser()
//
// generators: 
// 1. javascript/JavascriptModulesPlugin
// javascript/auto => new JavascriptGenerator()
// javascript/esm  => new JavascriptGenerator()
// javascript/dynamic => new JavascriptGenerator()
// 2. asset/AssetModulesPlugin
// asset => new AssetGenerator(...)
// asset/inline => new AssetGenerator(...)
// asset/resource => new AssetGenerator(...)
// asset/source => new AssetGenerator()
// 3. json/JsonModulesPluginnew
// json => new JsonGenerator()
// 4. wasm-async/AsyncWebAssemblyModulesPlugin
// webassembly/async => Generator.byType({javascript: new AsyncWebAssemblyJavascriptGenerator(...), webassembly: new AsyncWebAssemblyGenerator() })
// 5. wasm-sync/WebAssemblyModulesPlugin
// webassembly/sync => Generator.byType({ javascript: new WebAssemblyJavascriptGenerator(),webassembly: new WebAssemblyGenerator(...)})
//
// resolvers
// context => Factory.createResolver(resolveOptions)
// loader => Factory.createResolver(resolveOptions)
// normal => Factory.createResolver(resolveOptions)

class NormalModuleFactory extends ModuleFactory {}
// 
class ContextModuleFactory extends ModuleFactory {}
// 
class IgnoreErrorModuleFactory extends ModuleFactory {}
// 
class SelfModuleFactory extends ModuleFactory {}
//
class NullFactory extends ModuleFactory {}
//
class ContainerEntryModuleFactory extends ModuleFactory {}
//
class FallbackModuleFactory extends ModuleFactory {}
//
class LazyCompilationDependencyFactory extends ModuleFactory {}
// 
class ProvideSharedModuleFactory extends ModuleFactory {}
//
class DllModuleFactory extends ModuleFactory {}