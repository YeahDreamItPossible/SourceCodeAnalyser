// 代码生成
class Generator {
  generator(
    module, 
    { dependencyTemplates, runtimeTemplate, moduleGraph, type }
  ) {}
}

// 用于对资源类型: asset || asset/inline || asset/resource
class AssetGenerator extends Generator {}
// 用于对资源类型: asset/source
class AssetSourceGenerator extends Generator {}