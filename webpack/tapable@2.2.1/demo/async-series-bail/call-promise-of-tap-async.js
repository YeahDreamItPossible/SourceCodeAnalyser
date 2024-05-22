const tapable = require('tapable')

const hook = new tapable.AsyncSeriesBailHook(['name', 'age'], 'MyAsyncSeriesBailHook')

hook.tapAsync('before', (name, age, cb) => {
	console.log('before: ', name, age)
  console.log('before cb:', cb.toString())
  cb()
})

hook.tapAsync({
	name: 'after'
}, (name, age, cb) => {
	console.log('after: ', name, age)
  console.log('after cb:', cb.toString())
  cb()
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

// 这里的回调函数 除了error参数 是没有result参数的
hook.promise('Lee', 20).then(res => {
  console.log('over: ', res)
}).catch(err => {
  console.log('over error: ', err)
})
// 输出
// intercept register first
// intercept register first
// intercept register second
// intercept register second
// intercept call first:  Lee
// intercept call second:  Lee
// intercept tap first:  { type: 'async', fn: [Function (anonymous)], name: 'before' }
// intercept tap second:  { type: 'async', fn: [Function (anonymous)], name: 'before' }
// before:  Lee 20
// before cb: (_err0, _result0) => {
//   if(_err0) {
//     _error(_err0);
//   } else {
//     if(_result0 !== undefined) {
//       _resolve(_result0);
//     ;
//     } else {
//       _next0();
//     }
//   }
// }
// intercept tap first:  { type: 'async', fn: [Function (anonymous)], name: 'after' }
// intercept tap second:  { type: 'async', fn: [Function (anonymous)], name: 'after' }
// after:  Lee 20
// after cb: (_err1, _result1) => {
//   if(_err1) {
//     _error(_err1);
//   } else {
//     if(_result1 !== undefined) {
//       _resolve(_result1);
//     ;
//     } else {
//       _resolve();
//     }
//   }
// }
// over:  undefined

console.log(hook.promise.toString())
// 输出
function anonymous(name, age) {
  "use strict";
  return new Promise((_resolve, _reject) => {
    var _sync = true;
    function _error(_err) {
      if (_sync)
        _resolve(Promise.resolve().then(() => { throw _err; }));
      else
        _reject(_err);
    };
    var _context;
    var _x = this._x;
    var _taps = this.taps;
    var _interceptors = this.interceptors;
    _interceptors[0].call(name, age);
    _interceptors[1].call(name, age);
    function _next0() {
      var _tap1 = _taps[1];
      _interceptors[0].tap(_tap1);
      _interceptors[1].tap(_tap1);
      var _fn1 = _x[1];
      _fn1(name, age, (_err1, _result1) => {
        if (_err1) {
          _error(_err1);
        } else {
          if (_result1 !== undefined) {
            _resolve(_result1);
            ;
          } else {
            _resolve();
          }
        }
      });
    }
    var _tap0 = _taps[0];
    _interceptors[0].tap(_tap0);
    _interceptors[1].tap(_tap0);
    var _fn0 = _x[0];
    _fn0(name, age, (_err0, _result0) => {
      if (_err0) {
        _error(_err0);
      } else {
        if (_result0 !== undefined) {
          _resolve(_result0);
          ;
        } else {
          _next0();
        }
      }
    });
    _sync = false;
  });
}
