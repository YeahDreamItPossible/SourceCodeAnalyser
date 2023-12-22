// Module
class DependenciesBlock {
  constructor() {
    // 依赖
		this.dependencies = /* [ Dependency ] */ []
		// 分组块
		this.blocks = /* [ AsyncDependenciesBlock ] */ []
  }
}

class Module extends DependenciesBlock {
  constructor() {
    // 模块类型
		this.type = /* String */ ''
		// 上下文模块路径
		this.context = /* String */ ''
		/** @type {string | null} */
		this.layer = layer;
		// 标识: 标识当前module是否需要Id
		this.needId = /* Boolean */ true;

		this.resolveOptions = /* Object.create(null) */ null
		/** @type {object | undefined} */
		this.factoryMeta = undefined;
		this.useSourceMap = /* Boolean */ false
		this.useSimpleSourceMap = /* Boolean */ false


		// 警告
		this._warnings = /* [ WebpackError ] */ undefined
		// 错误
		this._errors = /* [ WebpackError ] */ undefined
		// 打包元信息
		this.buildMeta = /* BuildMeta */ undefined
		// 打包信息
		this.buildInfo = /* Record<string, any> */ undefined
		/** @type {Dependency[] | undefined} */
		this.presentationalDependencies = undefined;
  }
}

class NormalModule extends Module {}
class ContextModule extends Module {}