const toUpperCase = name => {
	if (name[0] === '_') {
		return name.slice(0, 2).toUpperCase() + name.slice(2)
	}
	return name.slice(0, 1).toUpperCase() + name.slice(1)
}

class MyPlugin {
	constructor (options) {
		this.options = options
	}

	apply (compiler) {
		console.log('MyPlugin')
		Reflect.ownKeys(compiler.__proto__).forEach(field => {
			const _field = compiler.__proto__[field]
			compiler.__proto__[field] = (...args) => {
				console.log('****  ' + field)
				return _field.call(compiler, ...args)
			}
		})
		compiler.hooks.make.tapAsync('EntryPlugin', (compilation, callback) => {
			const proto = compilation.constructor.prototype
			Reflect.ownKeys(proto).forEach(field => {
				const names = ['cache']
				if (!names.includes(field)) {
					if (typeof proto[field] === 'function') {
						const _field = compilation[field]
						const fields = ['modifyHash']
						if (!fields.includes(field) && !field.startsWith('_')) {
							compilation[field] = (...args) => {
								console.log(field)
								return _field.call(compilation, ...args)
							}
						}
					}
				}
			})
			callback()
		})
	}
}

module.exports = MyPlugin
