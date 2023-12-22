const normalModuleHooks = `
// 空调用
// 在创建完loader context后立即调用
beforeLoaders(normalModule.loaders, normalModule, loaderContext)

loaders()
readResourceForScheme()
`