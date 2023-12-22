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

class WorkerDependency extends Dependency {}
class HarmonyImportSideEffectDependency extends Dependency {}
class HarmonyImportSpecifierDependency extends Dependency {}
class HarmonyExportImportedSpecifierDependency extends Dependency {}
class HarmonyAcceptImportDependency extends Dependency {}
class AMDRequireItemDependency extends Dependency {}
class AMDRequireContextDependency extends Dependency {}
class CommonJsRequireDependency extends Dependency {}
class CommonJsFullRequireDependency extends Dependency {}
class CommonJsRequireContextDependency extends Dependency {}
class RequireResolveDependency extends Dependency {}
class RequireResolveContextDependency extends Dependency {}
class CommonJsExportRequireDependency extends Dependency {}
class CommonJsSelfReferenceDependency extends Dependency {}
class ModuleDecoratorDependency extends Dependency {}
class LoaderDependency extends Dependency {}
class LoaderImportDependency extends Dependency {}
class WebpackIsIncludedDependency extends Dependency {}
class RequireIncludeDependency extends Dependency {}
class RequireEnsureItemDependency extends Dependency {}
class RequireContextDependency extends Dependency {}
class ContextElementDependency extends Dependency {}
class ImportDependency extends Dependency {}
class ImportEagerDependency extends Dependency {}
class ImportWeakDependency extends Dependency {}
class ImportContextDependency extends Dependency {}
class URLDependency extends Dependency {}