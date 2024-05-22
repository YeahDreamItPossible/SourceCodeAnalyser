const tapable = require('tapable')

const hook = new tapable.SyncBailHook(['name', 'age'], 'MySyncBailHook')

hook.tap({
	name: 'before',
}, (name, age) => {
	console.log('before: ', name, age)
})

hook.tap('doing', (name, age) => {
	console.log('doing: ', name, age)
	return 'doing over'
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
	}
})

hook.call('Lee', 20)

// 输出
// intercept register first
// intercept register first
// intercept register first
// intercept register second
// intercept register second
// intercept register second
// intercept call first:  Lee
// intercept call second:  Lee
// intercept tap first:  { type: 'sync', fn: [Function (anonymous)], name: 'before' }
// intercept tap second:  { type: 'sync', fn: [Function (anonymous)], name: 'before' }
// before:  Lee 20
// intercept tap first:  { type: 'sync', fn: [Function (anonymous)], name: 'doing' }
// intercept tap second:  { type: 'sync', fn: [Function (anonymous)], name: 'doing' }
// doing:  Lee 20

console.log(hook.call.toString())
// 输出
function anonymous(name, age) {
  "use strict";
  var _context;
  var _x = this._x;
  var _taps = this.taps;
  var _interceptors = this.interceptors;
  _interceptors[0].call(name, age);
  _interceptors[1].call(name, age);
  var _tap0 = _taps[0];
  _interceptors[0].tap(_tap0);
  _interceptors[1].tap(_tap0);
  var _fn0 = _x[0];
  var _result0 = _fn0(name, age);
  if (_result0 !== undefined) {
    return _result0;
    ;
  } else {
    var _tap1 = _taps[1];
    _interceptors[0].tap(_tap1);
    _interceptors[1].tap(_tap1);
    var _fn1 = _x[1];
    var _result1 = _fn1(name, age);
    if (_result1 !== undefined) {
      return _result1;
      ;
    } else {
      var _tap2 = _taps[2];
      _interceptors[0].tap(_tap2);
      _interceptors[1].tap(_tap2);
      var _fn2 = _x[2];
      var _result2 = _fn2(name, age);
      if (_result2 !== undefined) {
        return _result2;
        ;
      } else {
      }
    }
  }
}