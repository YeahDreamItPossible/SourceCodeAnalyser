const sayHello = async () => {
  return 'Hello'
}

const doSay = async () => {
  let result = await sayHello()
  return result
}

// doSay().catch(err => {
//   console.log(err.toString())
// })

import.meta.webpack = 5

console.log(import.meta)
console.log(import.meta.__proto__)
// console.log(import.meta instanceof Null)