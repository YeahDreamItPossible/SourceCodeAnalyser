const webpack = require('webpack')
const path = require('path')
const MyPlugin = require('./plugins')

const compiler = webpack({
	mode: 'development',
	// target: 'web',
	// target: 'node',
	entry: path.join(__dirname, './src/index.js'),
	output: {
		// filename: '[name].js'
		filename: 'dist.js'
	},
	plugins: [
		new MyPlugin({name: 'MyPlugin'})
	],
	module: {
		rules: [
			{
				test: /\.txt/g,
				use: {
					loader: path.resolve(__dirname, './loaders/index.js')
				}
			}
		]
	}
}, (err) => {
	console.log('Error:', err)
})

// compiler.run((err, stats) => {
// 	if (err) throw err
// 	// console.log(Object.keys(stats))
// 	// console.log(Object.keys(stats.compilation))
// 	// console.log(stats.compilation.version)
// 	// console.log(stats.compilation.hash)
// 	// console.log(stats.compilation.time)
// 	// console.log(stats.compilation.assets)
// 	// console.log(stats.compilation.chunks)
// 	console.log(compiler.context)
// 	console.log(compiler.compilerPath)
// 	console.log(compiler.records)
// 	console.log(compiler.options)
// })

compiler.run((err, stats) => {
	// console.log(compiler.recordsInputPath)
	// console.log(compiler.recordsOutputPath)
	// console.log(compiler.records)
	console.log('over')
})
