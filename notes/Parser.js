// parser
class Parser {
  parse(source, state) {}
}

// 用于js 包括cjs mjs等等
class JavascriptParser extends Parser {}
// 用于json
class JsonParser extends Parser {}
// 用于对资源类型: asset || asset/inline || asset/resource
class AssetParser extends Parser {}
// 用于对资源类型: asset/source
class AssetSourceParser extends Parser {}
// 
class WebAssemblyParser extends Parser {}