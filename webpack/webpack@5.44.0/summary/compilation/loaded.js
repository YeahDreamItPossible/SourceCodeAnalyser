const addEntry = (context, entry, optionsOrName, callback) => {
	const options = { name: optionsOrName }
	this._addEntryItem(context, entry, "dependencies", options, callback)
}

// TODO: 暂时未梳理
const addInclude = (context, dependency, options, callback) => {
	this._addEntryItem(context, dependency, "includeDependencies", options, callback)
}

const _addEntryItem = (context, entry, target, options, callback) => {
	const entryData = {
		dependencies: [],
		includeDependencies: [],
		options: {
			name: undefined,
			...options
		}
	}
	entryData[target].push(entry);
	this.entries.set(name, entryData)

	this.addModuleTree(
		{
			context,
			dependency: entry,
			contextInfo: undefined
		},
		(err, module) => {
			return callback(err, module)
		}
	)
}

const addModuleTree = ({ context, dependency, contextInfo }, callback) => {
	this.handleModuleCreation(
		{
			factory: moduleFactory,
			dependencies: [dependency],
			originModule: null,
			contextInfo,
			context
		},
		err => {
			callback()
		}
	)
}

const handleModuleCreation = (
	{
		factory,
		dependencies,
		originModule,
		contextInfo,
		context,
		recursive = true,
		connectOrigin = recursive
	},
	callback
) => {
	this.factorizeModule(
		{
			currentProfile,
			factory,
			dependencies,
			originModule,
			contextInfo,
			context
		},
		(err, newModule) => {
			this.addModule(newModule, (err, module) => {
				this.buildModule(module, err => {
					this.processModuleDependencies(module, err => {
						callback(null, module)
					})
				})
			})
		}
	)
}

const factorizeModule = (options, callback) => {
	this.factorizeQueue.add(options, callback);
}

const _factorizeModule = (
	{
		currentProfile,
		factory,
		dependencies,
		originModule,
		contextInfo,
		context
	},
	callback
) => {
	factory.create(
		{
			contextInfo: {
				issuer: originModule ? originModule.nameForCondition() : "",
				issuerLayer: originModule ? originModule.layer : null,
				compiler: this.compiler.name,
				...contextInfo
			},
			resolveOptions: originModule ? originModule.resolveOptions : undefined,
			context: context
				? context
				: originModule
				? originModule.context
				: this.compiler.context,
			dependencies: dependencies
		},
		(err, result) => {
			const newModule = result.module
			callback(null, newModule)
		}
	)
}

const addModule = (module, callback) => {
	this.addModuleQueue.add(module, callback);
}

const _addModule = (module, callback) => {
	const identifier = module.identifier()
	this._modulesCache.get(identifier, null, (err, cacheModule) => {
		this._modules.set(identifier, module);
		this.modules.add(module);
		ModuleGraph.setModuleGraphForModule(module, this.moduleGraph)
		callback(null, module)
	})
}

const buildModule = (module, callback) => {
	this.buildQueue.add(module, callback)
}

const _buildModule = (module, callback) => {
	module.needBuild(
		{
			fileSystemInfo: this.fileSystemInfo,
			valueCacheVersions: this.valueCacheVersions
		},
		(err, module) => {
			module.build(
				this.options,
				this,
				this.resolverFactory.get("normal", module.resolveOptions),
				this.inputFileSystem,
				err => {
					this._modulesCache.store(module.identifier(), null, module, err => {
						callback()
					})
				}
			)
		}
	)
}

const processModuleDependencies = (module, callback) => {
	this.processDependenciesQueue.add(module, callback)
}

const _processModuleDependencies = (module, callback) => {
	const sortedDependencies = []

	const processDependency = dep => {
		sortedDependencies.push({
			factory: factoryCacheKey2,
			dependencies: list,
			originModule: module
		})
	}

	try {
		const queue = [module];
		do {
			const block = queue.pop();
			if (block.dependencies) {
				currentBlock = block;
				for (const dep of block.dependencies) processDependency(dep);
			}
			if (block.blocks) {
				for (const b of block.blocks) queue.push(b);
			}
		} while (queue.length !== 0)
	} catch (e) {}

	asyncLib.forEach(
		sortedDependencies,
		(item, callback) => {
			this.handleModuleCreation(item, err => {
				callback()
			})
		},
		err => {
			callback()
		}
	)
}
