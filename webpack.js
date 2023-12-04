function webpack(options) {
  // 1. 验证用户options是否合法

  // 2. create compiler
  // => create single compiler
  // => create multi compiler

}

function createCOmpiler(options) {
  // 1. normalizer(标准化) options

  // 2. options 初始化默认值

  // 3. create compiler

  // 4. 绑定compiler options
  // compiler.options = options

  // 5.1 生成日志插件 compiler.infrastructureLogger
	// 5.2 生成输入流 和 输出流 compiler.inputFileSystem compiler.outputFileSystem

  // 6. 注册用户自定义插件

  // 7. options 再次初始化默认值

  // hooks调用
  // compiler.hooks.environment.call();
	// compiler.hooks.afterEnvironment.call();

  // 8. options 根据不同的值 注册不同的内置插件
  // new WebpackOptionsApply().process(options, compiler);

  // hooks调用
  // compiler.hooks.initialize.call();
}