const SyncHook = require('../lib/SyncHook')

const hooks = new SyncHook(['name', 'age'])

hooks.tap('MySync', (name, age) => {
	console.log(name, age, '----')
})

hooks.call('Lee', 18)
console.log(hooks.taps[0].fn.toString())
console.log(hooks.call.toString())
