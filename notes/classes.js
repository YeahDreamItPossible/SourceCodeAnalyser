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
class Dependency {
  constructor() {
    // 位置信息
    this.loc = /* { ... }*/ null
    // 夫模块
    this._parentModule = /* Module */ null
    // 
    this._parentDependenciesBlock = /* DependenciesBlock */ null
    // 类型
    this.type = /* */ null
    // 分类
    this.category = /* */ null
  }
}
class ModuleDependency extends Dependency {
  constructor(request) {
    this.request = request;
		this.userRequest = request;
		this.range = undefined;
  }
}
class EntryDependency extends ModuleDependency {
  constructor() {
    this.type = 'entry'
    this.category = 'esm'
  }
}
// "WorkerDependency": "NormalModuleFactory",
// "EntryDependency": "NormalModuleFactory",
// "HarmonyImportSideEffectDependency": "NormalModuleFactory",
// "HarmonyImportSpecifierDependency": "NormalModuleFactory",
// "HarmonyExportImportedSpecifierDependency": "NormalModuleFactory",
// "HarmonyAcceptImportDependency": "NormalModuleFactory",
// "AMDRequireItemDependency": "NormalModuleFactory",
// "AMDRequireContextDependency": "ContextModuleFactory",
// "CommonJsRequireDependency": "NormalModuleFactory",
// "CommonJsFullRequireDependency": "NormalModuleFactory",
// "CommonJsRequireContextDependency": "ContextModuleFactory",
// "RequireResolveDependency": "NormalModuleFactory",
// "RequireResolveContextDependency": "ContextModuleFactory",
// "CommonJsExportRequireDependency": "NormalModuleFactory",
// "CommonJsSelfReferenceDependency": "SelfModuleFactory",
// "ModuleDecoratorDependency": "SelfModuleFactory",
// "LoaderDependency": "NormalModuleFactory",
// "LoaderImportDependency": "NormalModuleFactory",
// "WebpackIsIncludedDependency": "IgnoreErrorModuleFactory",
// "RequireIncludeDependency": "NormalModuleFactory",
// "RequireEnsureItemDependency": "NormalModuleFactory",
// "RequireContextDependency": "ContextModuleFactory",
// "ContextElementDependency": "NormalModuleFactory",
// "ImportDependency": "NormalModuleFactory",
// "ImportEagerDependency": "NormalModuleFactory",
// "ImportWeakDependency": "NormalModuleFactory",
// "ImportContextDependency": "ContextModuleFactory",
// "URLDependency": "NormalModuleFactory"


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
// parsers: (javascript/JavascriptModulesPlugin)
// javascript/auto => new JavascriptParser("auto")
// javascript/esm  => new JavascriptParser("module")
// javascript/dynamic => new JavascriptParser("script")
// generators: (javascript/JavascriptModulesPlugin)
// javascript/auto => new JavascriptGenerator()
// javascript/esm  => new JavascriptGenerator()
// javascript/dynamic => new JavascriptGenerator()
class NormalModuleFactory extends ModuleFactory {}
// 
class ContextModuleFactory extends ModuleFactory {}
// 
class IgnoreErrorModuleFactory extends ModuleFactory {}
// 
class SelfModuleFactory extends ModuleFactory {}

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


// Template
class Template {}

// "WorkerDependency": "WorkerDependencyTemplate",
// "CreateScriptUrlDependency": "CreateScriptUrlDependencyTemplate",
// "RuntimeRequirementsDependency": "RuntimeRequirementsDependencyTemplate",
// "ConstDependency": "ConstDependencyTemplate",
// "HarmonyCompatibilityDependency": "HarmonyExportDependencyTemplate",
// "HarmonyImportSideEffectDependency": "HarmonyImportSideEffectDependencyTemplate",
// "HarmonyImportSpecifierDependency": "HarmonyImportSpecifierDependencyTemplate",
// "HarmonyExportHeaderDependency": "HarmonyExportDependencyTemplate",
// "HarmonyExportExpressionDependency": "HarmonyExportDependencyTemplate",
// "HarmonyExportSpecifierDependency": "HarmonyExportSpecifierDependencyTemplate",
// "HarmonyExportImportedSpecifierDependency": "HarmonyExportImportedSpecifierDependencyTemplate",
// "HarmonyAcceptDependency": "HarmonyAcceptDependencyTemplate",
// "HarmonyAcceptImportDependency": "HarmonyAcceptImportDependencyTemplate",
// "AMDRequireDependency": "AMDRequireDependencyTemplate",
// "AMDRequireItemDependency": "ModuleDependencyTemplateAsRequireId",
// "AMDRequireArrayDependency": "AMDRequireArrayDependencyTemplate",
// "AMDRequireContextDependency": "ContextDependencyTemplateAsRequireCall",
// "AMDDefineDependency": "AMDDefineDependencyTemplate",
// "UnsupportedDependency": "UnsupportedDependencyTemplate",
// "LocalModuleDependency": "LocalModuleDependencyTemplate",
// "CommonJsRequireDependency": "ModuleDependencyTemplateAsId",
// "CommonJsFullRequireDependency": "CommonJsFullRequireDependencyTemplate",
// "CommonJsRequireContextDependency": "ContextDependencyTemplateAsRequireCall",
// "RequireResolveDependency": "ModuleDependencyTemplateAsId",
// "RequireResolveContextDependency": "ContextDependencyTemplateAsId",
// "RequireResolveHeaderDependency": "RequireResolveHeaderDependencyTemplate",
// "RequireHeaderDependency": "RequireHeaderDependencyTemplate",
// "CommonJsExportsDependency": "CommonJsExportsDependencyTemplate",
// "CommonJsExportRequireDependency": "CommonJsExportRequireDependencyTemplate",
// "CommonJsSelfReferenceDependency": "CommonJsSelfReferenceDependencyTemplate",
// "ModuleDecoratorDependency": "ModuleDecoratorDependencyTemplate",
// "ExportsInfoDependency": "ExportsInfoDependencyTemplate",
// "WebpackIsIncludedDependency": "WebpackIsIncludedDependencyTemplate",
// "CachedConstDependency": "CachedConstDependencyTemplate",
// "RequireIncludeDependency": "RequireIncludeDependencyTemplate",
// "RequireEnsureItemDependency": "NullDependencyTemplate",
// "RequireEnsureDependency": "RequireEnsureDependencyTemplate",
// "RequireContextDependency": "ModuleDependencyTemplateAsRequireId",
// "ImportDependency": "ImportDependencyTemplate",
// "ImportEagerDependency": "ImportEagerDependencyTemplate",
// "ImportWeakDependency": "ImportDependencyTemplate",
// "ImportContextDependency": "ContextDependencyTemplateAsRequireCall",
// "URLDependency": "URLDependencyTemplate"