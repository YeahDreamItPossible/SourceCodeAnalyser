"use strict";

/**
 * 模块工厂(ModuleFactory)分类:
 * 
 * 标准模块工厂(NormalModuleFactory):
 * 创建 标准模块 的实例
 * 
 * 上下文模块工厂(ContextModuleFactory):
 * 创建 上下文模块 的实例
 * 
 * 动态链接库模块工厂(DllModuleFactory):
 * 创建 动态链接库模块 的实例
 * 
 * 忽略错误模块工厂(IgnoreErrorModuleFactory):
 * 当在 创建标准模块 时 忽略报错 仍然返回 标准模块 的实例
 * 
 * 空模块工厂(NullFactory):
 * 
 * 容器入口模块工厂(ContainerEntryModuleFactory):
 * 在 模块联邦 插件中创建 容器入口模块
 * 
 * 回退模块工厂(FallbackModuleFactory):
 * 在 模块联邦 插件中创建 回退模块 的实例
 * 
 * (LazyCompilationDependencyFactory):
 * 
 * (ProvideSharedModuleFactory):
 * 
 */

// 模块工厂
// 作用:
// 创建对应的 模块 实例
class ModuleFactory {
	// 创建 Module 的实例
	create(data, callback) {
		const AbstractMethodError = require("./AbstractMethodError");
		throw new AbstractMethodError();
	}
}

module.exports = ModuleFactory;
