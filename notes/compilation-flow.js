const flow = `
addEntry(添加多个入口 如多页面应用)(入参: context entry options callback)
		_addEntryItem(依次添加单个入口)
			addModuleTree(根据 dep 找到对应 factory)
				handleModuleCreation(构建模块 该函数可递归调用)
					factorizeModule
						_factorizeModule(创建module)
							addModule
								_addModule(缓存module)
									buildModule
										_buildModule(解析模块 获取source文件以及dependencies)
											processModuleDependencies
												_processModuleDependencies
					handleModuleCreation
						factorizeModule
							_factorizeModule
								...(递归解析)
	
	finish(缓存模块 并收集errors 和 warnings)

	seal

		codeGeneration
			_runCodeGenerationJobs
				_codeGenerationModule
				是为了获得 codeGenerationResults
			
				createHash
				_runCodeGenerationJobs
					clearAssets
					createModuleAssets
					createChunkAssets
						getRenderManifest
						getPathWithInfo
						emitAsset


`