const tapable = require('../../lib/index.js')

const hook = new tapable.SyncHook(['name', 'age'], 'SyncHook')

hook.tap('before', (name, age) => {
  console.log('before: ', name, age)
})

hook.tap('after', (name, age) => {
  console.log('after: ', name, age)
})

hook.call('Lee', 20)

console.log(hook.call.toString())

console.log()

hook.callAsync('Lee', 20, () => {
  console.log('over')
})

console.log(hook.callAsync.toString())

console.log()

hook.promise('Lee', 20).then(() => {
  console.log('over')
}).catch(err => console.log('err'))

console.log(hook.promise.toString())
