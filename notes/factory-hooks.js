// 钩子注册 javascript/JavascriptModulePlugin
/**
 * 
 */
const normalModuleFactoryHooks = `
// 直接执行回调
beforeResolve(resolveData)

  // ExternalModuleFactoryPlugin(主要是处理options.externals)
  // NormalModuleFactory
  factorize(resolveData)

    /**
     * 先根据request获取loaders 行内[{loader: String, options: Object}]
     * 再根据匹配规则获取到自定义使用的 loaders
     * 最后根据规则或者request路径参数来筛选loaders
     */
    // 1. 获取loaders
    // 2. 获取到parser
    // 3. 获取到generator
    resolve(resolveData)
      // 
      resolveForScheme(HookMap)

      //
      createParser
      parser
      createGenerator
      generator

      // 直接执行回调
      // resolveData.createData就是resolve钩子加工处理得到的数据
      afterResolve(resolveData.createData, resolveData)

        // 直接执行回调, 在回调函数中创建NormalModule
        // createdModule = new NormalModule(resolveData.createData)
        createModule(createdModule)

          // SideEffectsFlagPlugin
          module(createdModule, resolveData.createData)
`

