```js
jest => 执行 jest-cli 中 run 函数
jest-cli => 解析命令行参数，并解析 配置选项, 最终执行 jest-core中 runCli 函数
jest-core => 根据命令行参数运行对应的函数(如 watch 选项)， 最终执行 runJest 函数
            在 runJest 函数中 根据配置 启动对应的类， 如 运行期， 定序器，调度器， 并解析要运行的单测文件路径集合， 并执行调度任务 scheduler.scheduleTests
jest-circus => 默认调度器
jest-runtime => 运行时，执行单测函数代码
jest-environment => 特定环境下注入全局变量
jest-runner => 运行器，


jest-circus  =>  绑定全局变量 例如：(afterAll, afterEach, beforeAll, beforeEach, describe, it, test)

expect => 绑定全局变量 expect
expect-utils => expect 辅助函数工具
jest-mock => 绑定(jest.fn jest.spyOn jest.mocked jest.replaceProperty)
```

```js
名词解释:
```

```js
Runner(运行器) 
1. 以 串行 或者 并行的方式 运行单测温文件
2. 获取 Environment 及 Runtime 及 TestFramework
Environment(环境)：
Runtime(运行时)：
Report(报告器):

EventHandler(事件处理器): 根据特定的事件 更新状态
```

```js
Matcher 匹配器
Test Suite 测试套件： 通过 describe 组织的一组相关测试用例
Test Case 测试用例： 通过 test 或 it 定义的单个测试单元
Coverage 覆盖率
行覆盖率（Line Coverage）：代码行执行比例。
分支覆盖率（Branch Coverage）：条件分支（如 if）覆盖比例。
函数覆盖率（Function Coverage）：函数调用比例。
```