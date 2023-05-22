const tapable = require('tapable')

const hook = new tapable.SyncLoopHook(['name', 'age'], 'MySyncBailHook')

let count = 0

function stop () {
	count++
	if (count <= 5) return 'go on'
	return
}

hook.tap({
	name: 'before',
	context: true
}, (context, name, age) => {
	console.log('before: ',context, name, age)
	stop()
})

hook.tap('doing', (context, name, age) => {
	console.log('doing: ',context, name, age)
	return stop()
})

hook.tap('after', (context,name, age) => {
	console.log('after: ', context, name, age)
	return stop()
})

let uid = 0
hook.intercept({
	context: {},

	register (options) {
		console.log('intercept register first')
		options.uid = ++uid
		return options
	},

	call (context, options) {
		console.log('intercept call first: ', context, options)
	},

	tap (context, options) {
		context.uid = uid
		console.log('intercept tap first: ', context, options)
	}
})

hook.intercept({
	context: {},

	register (options) {
		console.log('intercept register second')
		options.uid = ++uid
		return options
	},

	call (context, options) {
		console.log('intercept call second: ', context, options)
	},

	tap (context, options) {
		context.uid = ++uid
		console.log('intercept tap second: ', context, options)
	}
})

hook.call('Lee', 20)

// console.log(hook.call.toString())
// 输出
// intercept register first
// intercept register first
// intercept register first
// intercept register second
// intercept register second
// intercept register second
// intercept call first:  {} Lee
// intercept call second:  {} Lee
// intercept tap first:  { uid: 6 } {
//   type: 'sync',
//   fn: [Function (anonymous)],
//   name: 'before',
//   context: true,
//   uid: 4
// }
// intercept tap second:  { uid: 7 } {
//   type: 'sync',
//   fn: [Function (anonymous)],
//   name: 'before',
//   context: true,
//   uid: 4
// }
// before:  { uid: 7 } Lee 20
// intercept tap first:  { uid: 7 } { type: 'sync', fn: [Function (anonymous)], name: 'doing', uid: 5 }
// intercept tap second:  { uid: 8 } { type: 'sync', fn: [Function (anonymous)], name: 'doing', uid: 5 }
// doing:  Lee 20 undefined
// intercept tap first:  { uid: 8 } {
//   type: 'sync',
//   fn: [Function (anonymous)],
//   name: 'before',
//   context: true,
//   uid: 4
// }
// intercept tap second:  { uid: 9 } {
//   type: 'sync',
//   fn: [Function (anonymous)],
//   name: 'before',
//   context: true,
//   uid: 4
// }
// before:  { uid: 9 } Lee 20
// intercept tap first:  { uid: 9 } { type: 'sync', fn: [Function (anonymous)], name: 'doing', uid: 5 }
// intercept tap second:  { uid: 10 } { type: 'sync', fn: [Function (anonymous)], name: 'doing', uid: 5 }
// doing:  Lee 20 undefined
// intercept tap first:  { uid: 10 } {
//   type: 'sync',
//   fn: [Function (anonymous)],
//   name: 'before',
//   context: true,
//   uid: 4
// }
// intercept tap second:  { uid: 11 } {
//   type: 'sync',
//   fn: [Function (anonymous)],
//   name: 'before',
//   context: true,
//   uid: 4
// }
// before:  { uid: 11 } Lee 20
// intercept tap first:  { uid: 11 } { type: 'sync', fn: [Function (anonymous)], name: 'doing', uid: 5 }
// intercept tap second:  { uid: 12 } { type: 'sync', fn: [Function (anonymous)], name: 'doing', uid: 5 }
// doing:  Lee 20 undefined
// intercept tap first:  { uid: 12 } { type: 'sync', fn: [Function (anonymous)], name: 'after', uid: 6 }
// intercept tap second:  { uid: 13 } { type: 'sync', fn: [Function (anonymous)], name: 'after', uid: 6 }
// after:  Lee 20 undefined

console.log(hook.promise.toString())
// 输出
function anonymous(name, age) {
  "use strict";
  var _context = {};
  var _x = this._x;
  var _taps = this.taps;
  var _interceptors = this.interceptors;
  _interceptors[0].call(_context, name, age);
  _interceptors[1].call(_context, name, age);
  var _loop;
  do {
    _loop = false;
    var _tap0 = _taps[0];
    _interceptors[0].tap(_context, _tap0);
    _interceptors[1].tap(_context, _tap0);
    var _fn0 = _x[0];
    var _result0 = _fn0(_context, name, age);
    if (_result0 !== undefined) {
      _loop = true;
    } else {
      var _tap1 = _taps[1];
      _interceptors[0].tap(_context, _tap1);
      _interceptors[1].tap(_context, _tap1);
      var _fn1 = _x[1];
      var _result1 = _fn1(name, age);
      if (_result1 !== undefined) {
        _loop = true;
      } else {
        var _tap2 = _taps[2];
        _interceptors[0].tap(_context, _tap2);
        _interceptors[1].tap(_context, _tap2);
        var _fn2 = _x[2];
        var _result2 = _fn2(name, age);
        if (_result2 !== undefined) {
          _loop = true;
        } else {
          if (!_loop) {
          }
        }
      }
    }
  } while (_loop);
}