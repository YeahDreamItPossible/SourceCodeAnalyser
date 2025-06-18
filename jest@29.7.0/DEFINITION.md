```js
名词解释
```

```js
Matcher(匹配器):

Test Suite(测试套件)： 
  通过 describe 组织的一组相关测试用例
Test Case(测试用例)： 
  通过 test 或 it 定义的单个测试单元

Coverage(覆盖率):

行覆盖率(Line Coverage):
  代码行执行比例。
分支覆盖率(Branch Coverage):
  条件分支(如 if)覆盖比例。
函数覆盖率(Function Coverage)：
  函数调用比例
```

```js
Environment(环境)：
  当前单测所运行的环境(jsdom or nodejs)
```

```js
Resolver(路径解析器):
  将模块引入路径转换成绝对路径
```

```js
Runtime(运行时): 
  代码被执行时的运行过程
```

```js
Runner(运行器) 
  1. 以 串行 或者 并行的方式 运行单测温文件
  2. 获取执行单测文件中的代码所需要的上下文(如: Environment,Transform,Runtime,TestFramework等)，并执行单测单测
```

```js
Report(报告器):
  报告器: 生成单测结果报告
```

```js
EventHandler(事件处理器): 
  根据特定的事件 更新状态树的节点状态
  在执行(afterAll, afterEach, beforeAll, beforeEach, describe, it, test)时,会触发特定的事件，并构建状态树
``