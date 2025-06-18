```js
jest: 
  执行 jest-cli 的 run 函数
jest-cli:  
  解析命令行参数，并最终运行 jest-core 的 runCli 函数
jest-core: 
  根据命令行参数运行对应的函数(如 watch 选项)， 最终执行 runJest 函数
  在 runJest 函数中 根据配置 启动对应的类， 如 运行期， 定序器，调度器， 并解析要运行的单测文件路径集合， 并执行调度任务 scheduler.scheduleTests
```

```js
jest-config:
  jest 的配置选项
jest-validate:
  检验 jest 的配置选项是否有效
```

```js
jest-environment:
  特定环境下注入全局变量
jest-environment-jsdom:
  继承 jest-environment ，并注入 浏览器环境 相关全局变量
jest-environment-node:
  继承 jest-environment ，并注入 node环境 相关全局变量
```

```js
expect:
  绑定全局变量 expect
expect-utils:
  expect 辅助函数工具
jest-mock:
  绑定(jest.fn jest.spyOn jest.mocked jest.replaceProperty)
```

```js
jest-circus:
  绑定全局变量 例如：(afterAll, afterEach, beforeAll, beforeEach, describe, it, test)
  默认运行器
  构建用例树(执行全局钩子时，会构建状态树)
```

```js
jest-runner:
  运行器，
```

```js
jest-resolve:
  解析器
babel-jest:
  jest 环境代码下的 转换器
jest-transform:
  根据 配置 加载对应的转换器
jest-runtime:
  运行时，执行单测函数代码(读取代码 转换代码 包装代码 执行代码)
  注入 jest 对象，是在该 _createJestObjectFor 创建的
```

