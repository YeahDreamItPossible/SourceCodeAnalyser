```js
名词解释:
```

```js
Parser	解析器	将源代码转换为 AST（如 @babel/parser）
Traverse	遍历	递归访问 AST 节点并修改（如 babel.traverse(ast, visitor)）
Transform	转换	对 AST 进行修改的规则集合（如编写 Babel 插件实现代码转换）
Visitor	访问器	定义 traverse 时如何处理特定节点类型（如 visitor: { FunctionDeclaration() {...} }）
Generator	代码生成器	将 AST 转换回源代码（如 @babel/generator）
Plugin	插件	实现具体转换逻辑的模块（如 @babel/plugin-transform-arrow-functions）
Preset	预设	插件集合的配置包（如 @babel/preset-env）
NodePath	路径节点	在遍历 AST 时，表示节点及其关联信息的对象（含父子节点引用）
AST	抽象语法树	源代码结构化的树形表示（Babel 操作的核心数据结构）
Polyfill	垫片	实现新语法/API 的兼容代码（如 @babel/polyfill，现已被 core-js 替代）
```