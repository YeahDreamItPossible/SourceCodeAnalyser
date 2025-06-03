名词解释

```
Compiler
编译器
作用:
1. 绑定 compiler 的文件系统 日志系统 缓存系统
2. 绑定 compiler 的路径解析器
3. 对 编译过程 任务调度
```

```
Compilation
编译过程
编译过程可以分为以下几个流程
1. 模块树的构建
创建模块 并在构建模块的过程中 递归的解析模块中的依赖 构建 模块 与 依赖的图谱关系(ModuleGraph)
2. 冻结
2. 分块
根据 入口 进行分块 并构建 块 与 模块 的图谱关系(ChunkGraph)
3. 模块Id 模块哈希值 块Id 块哈希值
4. 优化
优化模块 优化块 优化块中模块
5. 模块代码生成
6. 块代码生成
7. 文件输出


1. 构建模块树(load)
2. 收集模块中的错误和警告
3. 冻结(seal)
4. 分块
5. 优化(优化依赖，模块，块)
6. 设置ID
7. 设置哈希(hash)
8. 模块代码生成
9. 块代码生成
9. 生成文件缓存及解析


代码生成
1. 模块代码生成
2. 运行时块代码生成
3. 块代码生成
```

```
ModuleGraph
  模块图(ModuleGraph) 构建发生在 添加模块 创建模块 构建模块 解析依赖 等的过程中
ChunkGraph
  块图(ChunkGraph) 构建发生在 分块 的过程
在优化阶段
  优化依赖  => 分块 => 优化模块 => 优化块 => 优化依赖树 => 优化块模块 => 优化模块Id => 优化块Id =>
创建模块哈希 => 代码生成任务 => 

```

```
ModuleFactory
模块工厂
作用:
  创建对应的 模块 实例
```

```
ContextModuleFactory
上下文模块工厂
作用:
  - 创建 上下文模块 的实例

  - 通过 语法分析器 对 webpack 独特的 require.context API 生成依赖关系
  - 根据 依赖 找到 上下文模块工厂
  - 创建 上下文模块 的实例
```

```
NormalModuleFactory
标准模块工厂
作用:
  - 获取创建 标准模块 所需要的所有参数 并创建 标准模块 的实例
  - 但是对 标准模块 并没有经过 语法分析器 分析其词法语法
```

```
Loader
加载器
按照 加载器 引入方式 分类:
- 行内加载器(别名: 内联加载器):
  在 不同的模块 引入依赖时语句中指定的加载器 使用 ! 将资源中的 loader 分开
  只针对于 引入的模块
  示例: import styles from 'style-loader?name=lee!./src/styles/global.css'
- 配置加载器:
  在 配置文件 中 对 模块规则 配置的匹配规则
  针对于 全局模块
  示例: Webpack.options.module.Rule.loader | Webpack.options.module.Rule.use
```

```
根据 加载器 使用顺序 分类：
  - 前置加载器(preLoader)
  - 标准加载器(loader)
  - 后置加载器(postLoader)
```

```
加载器标准化
  Loader<{ loader: String, options: String, ident: String }>
  Loader.loader  加载器路径(绝对路径)
  Loader.options 加载器选项
  Loader.ident   加载器标识符
配置加载器标识符:
  在 规则集合 中的路径 示例: ruleSet[0].test
行内加载器标识符：
  行内加载器选项字符串 示例: name=Lee&age=12
```

```
加载器 解析的整个过程
  1. 编译阶段
    1.1 在创建 标准模块工厂 的实例时 已经完成对 规则集合 的编译 返回 匹配器(此时完成对 配置加载器 的编译)
    1.2 在 hooks.resolve 阶段 根据 模块依赖请求路径 完成对路径中的 行内加载器 的编译 返回所有标准化的行内加载器
  2. 匹配阶段
    2.1 在 hooks.resolve 阶段 先执行 匹配器 匹配函数 返回所有的副作用(返回筛选后的配置加载器)
    2.2 再根据 模块请求路径路径 禁用loader规则 来返回筛选后的所有行内加载器
    2.3 将筛选后的 所有行内加载器 合并到筛选后的 配置加载器 中
```

```
标准模块工厂
  获取创建 NormalModule 所需要的所有参数,并创建 NormalModule 的实例 
主要参数如下:
  1. 特定类型的路径解析器(resolver)
  2. 所有的加载器(Loader)
  3. 特定类型的语法分析器(parser)
  4. 特定类型的代码生成器(generator)
  5. 解析后的模块路径
  6. ...
```

```
ModuleTree
  模块树
模块树的构建过程
  1. 添加入口 addEntryItem
  2. 创建模块 factorizeModule
  3. 添加模块 addModule
  4. 构建模块 buildModule
  5. 解析依赖 processModuleDependencies(绑定Module 与 Module， Module 与 Dependency的关联关系)
```

```
模块图出现的原因:
  - 单个模块 与 依赖 之间是复杂的 一对多关系
  - 单个依赖 与 模块 之间也是复杂的 一对多关系
  - 多个模块 与 多个依赖 之间是复杂的 多对多关系

ModuleGraph
  模块图
作用:
  - 以 模块 为核心 描述模块的引用关系
  - 描述 模块Module 与 依赖Dependency 的引用关系
  - 描述 模块Module 与 模块Module 的引用关系

ModuleGraphModule
  模块图模块
作用:
  - 以 模块 为核心 描述模块间的相互引用关系
    1. 当前模块 与 被它引用的 子模块 间的相互引用关系
    2. 当前模块 与 引用它的 父模块 间的相互引用关系
  在 ModuleGraph 中 通过 Module 找到对应的 ModuleGraphModule

ModuleGraphConnection
  模块图连接
作用:
  - 以 依赖 为核心 描述当前依赖的引用关系
    1. 当前依赖Dependency 与 引用当前依赖的模块Module 的引用关系
    2. 引用当前依赖的模块Module 与 引用当前依赖的模块的父模块Module 的引用关系
  在 ModuleGraph 中 通过 Dependency 找到对应的 ModuleGraphConnection
```


```
块出现的原因:
  我们书写的模块是零散的 需要用 块 来对这些模块的引用关系进行系统的记录
Chunk 分类:
  - RuntimeChunk 运行时块
    (包含 webpack 在运行环境运行时所需的代码, 主要是用于处理模块的加载和依赖关系)
  - EntrypointChunk 入口块
    (由 Webpack.options.Entry 生成的块, 是打包过程的入口点, 包含了应用程序的入口点模块及其依赖)

Chunk
  块
作用:
  块 是 模块(Module) 的封装单元 描述了对 模块 的使用信息
  当 构建完成 时 块(Chunk) 被渲染成 捆(Bundle)
  块 存储着 入口信息 和 对应的出口信息
  在 ChunkGraph 中 能够 根据 块 找到对应的 模块信息 


块图:
  - 单个块 与 模块 之间是复杂的 一对多关系
  - 单个模块 与 块 之间也是复杂的 一对多关系
  - 多个块 与 多个模块 之间是复杂的 多对多关系

ChunkGraph
  块图
作用:
  以 块 为核心 描述 块 的引用关系
    1. 以 块 为核心 描述 当前块 与其 当前块引用的模块 的引用关系
    2. 以 模块 为核心 描述 模块 与其 当前模块属于哪些块 的引用关系

ChunkGraphChunk
  块图块
作用:
  以 块 为核心 描述 当前块 中所包含的 模块
  在 ChunkGraph 中 根据 Chunk 找到对应的 ChunkGraphChunk

ChunkGraphModule
  块图模块
作用:
  以 模块 为核心 描述 当前模块 属于哪些 块
  在 ChunkGraph 中 根据 Module 找到对应的 ChunkGraphModule
```