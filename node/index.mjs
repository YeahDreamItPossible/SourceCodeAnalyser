import child_process from 'node:child_process'
import { nextTick } from 'node:process'

const child = child_process.fork('./child.mjs')

child.on('message', data => {
  console.log(data.toString())
})

nextTick(() => {
  child.send('Hello')
})

