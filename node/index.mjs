import fs from 'node:fs'

fs.access('./index.html', fs.constants.F_OK, err => {
  console.log(2, err)
})