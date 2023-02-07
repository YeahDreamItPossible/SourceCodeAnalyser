process.on('message', data => {
  console.log('child', data.toString())

  process.send('Hi')

  process.exit(0)
})
