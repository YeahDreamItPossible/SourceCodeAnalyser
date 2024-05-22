const tapable = require('tapable')

const hook = new tapable.SyncHook(['name', 'age'], 'MySyncHook')

hook.tap({
	name: 'before'
}, (name, age) => {
	console.log('before: ', name, age)
})

hook.tap('after', (name, age) => {
	console.log('after: ', name, age)
})

hook.intercept({
	register (options) {
		console.log('intercept register first')
		return options
	},

	call (options) {
		console.log('intercept call first: ', options)
	},

	tap (options) {
		console.log('intercept tap first: ', options)
	},

	result (result) {
    console.log('intercept tap first: ', result)
  },

  error (err) {
  	console.log('intercept error first: ', err)
  },

  done () {
  	console.log('intercept done first: ')
  }
})

hook.intercept({
	register (options) {
		console.log('intercept register second')
		return options
	},

	call (options) {
		console.log('intercept call second: ', options)
	},

	tap (options) {
		console.log('intercept tap second: ', options)
	},

	result (result) {
    console.log('intercept tap second: ', result)
  },

  error (err) {
  	console.log('intercept error second: ', err)
  },

  done () {
  	console.log('intercept done second: ')
  }
})

hook.callAsync('Lee', 20, (err, res) => {
	if (err) {
		console.log('cb error: ', err)
		return
	}
	console.log('cb result: ', res)
})
// 输出
// intercept register first
// intercept register first
// intercept register second
// intercept register second
// intercept call first:  Lee
// intercept call second:  Lee
// intercept tap first:  { type: 'sync', fn: [Function (anonymous)], name: 'before' }
// intercept tap second:  { type: 'sync', fn: [Function (anonymous)], name: 'before' }
// before:  Lee 20
// intercept tap first:  { type: 'sync', fn: [Function (anonymous)], name: 'after' }
// intercept tap second:  { type: 'sync', fn: [Function (anonymous)], name: 'after' }
// after:  Lee 20
// cb result:  undefined

console.log(hook.callAsync.toString())
// 输出
function anonymous(name, age, _callback) {
  'use strict'
  var _context
  var _x = this._x
  var _taps = this.taps
  var _interceptors = this.interceptors
  _interceptors[0].call(name, age)
  _interceptors[1].call(name, age)
  var _tap0 = _taps[0]
  _interceptors[0].tap(_tap0)
  _interceptors[1].tap(_tap0)
  var _fn0 = _x[0]
  var _hasError0 = false
  try {
    _fn0(name, age)
  } catch (_err) {
    _hasError0 = true
    _callback(_err)
  }
  if (!_hasError0) {
    var _tap1 = _taps[1]
    _interceptors[0].tap(_tap1)
    _interceptors[1].tap(_tap1)
    var _fn1 = _x[1]
    var _hasError1 = false
    try {
      _fn1(name, age)
    } catch (_err) {
      _hasError1 = true
      _callback(_err)
    }
    if (!_hasError1) {
      _callback()
    }
  }
}