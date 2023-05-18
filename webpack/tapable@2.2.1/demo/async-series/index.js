const tapable = require('../../lib/index.js')

const hook = new tapable.AsyncSeriesHook(['name', 'age'], 'AsyncSeriesHook')

hook.tapAsync('before', (name, age, next) => {
  console.log('before: ', name, age)
  next()
})

hook.tapAsync('after', (name, age, next) => {
  console.log('after: ', name, age)
  next()
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