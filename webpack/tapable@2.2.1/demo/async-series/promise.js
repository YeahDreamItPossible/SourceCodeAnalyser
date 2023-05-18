const tapable = require('../../lib/index.js')

const hook = new tapable.AsyncSeriesHook(['name', 'age'], 'AsyncSeriesHook')

hook.tapPromise('before', (name, age) => {
  console.log('before: ', name, age)
  return Promise.resolve()
})

hook.tapPromise('after', (name, age) => {
  console.log('after: ', name, age)
  return Promise.resolve()
})

hook.callAsync('Lee', 20, () => {
  console.log('over')
})

console.log(hook.callAsync.toString())

console.log()

hook.promise('Lee', 20).then(() => {
  console.log('then')
}).catch(() => console.log('catch'))

console.log(hook.promise.toString())