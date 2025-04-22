try {
  const { enableCompileCache } = require('node:module')
  if (enableCompileCache) {
    enableCompileCache()
  }
} catch (e) { }

const validateEngines = require('./cli/validate-engines.js')
const cliEntry = require('node:path').resolve(__dirname, 'cli/entry.js')

module.exports = (process) => validateEngines(process, () => require(cliEntry))
