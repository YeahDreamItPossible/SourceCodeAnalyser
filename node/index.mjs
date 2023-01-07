const sayHello = async () => {
  // return 'Hello'
  throw new Error('?')
}

const doSay = async () => {
  let result = await sayHello()
  return result
}

doSay().catch(err => {
  console.log(err.toString())
})