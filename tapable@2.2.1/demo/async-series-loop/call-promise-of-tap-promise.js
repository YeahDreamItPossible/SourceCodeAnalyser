const tapable = require('tapable')

const hook = new tapable.AsyncSeriesLoopHook(['name', 'age'], 'MyAsyncSeriesLoopHook')

hook.tapPromise({
	name: 'before'
}, (name, age) => {
	console.log('before: ', name, age)
  // return Promise.resolve('before')
  return Promise.resolve()
})

hook.tapPromise({
	name: 'after'
}, (name, age) => {
	console.log('after: ', name, age)
  // return Promise.resolve('after')
  return Promise.resolve()
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
// intercept tap first:  { type: 'promise', fn: [Function (anonymous)], name: 'before' }
// intercept tap second:  { type: 'promise', fn: [Function (anonymous)], name: 'before' }
// before:  Lee 20
// intercept tap first:  { type: 'promise', fn: [Function (anonymous)], name: 'after' }
// intercept tap second:  { type: 'promise', fn: [Function (anonymous)], name: 'after' }
// after:  Lee 20
// intercept done first: 
// intercept done second: 
// over:  undefined

console.log(hook.promise.toString())
// 输出
function anonymous(name, age) {
  "use strict";
  var _context;
  var _x = this._x;
  var _taps = this.taps;
  var _interceptors = this.interceptors;
  return new Promise((function (_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if (_sync)
        _resolve(Promise.resolve().then((function () { throw _err; })));
      else
        _reject(_err);
    };
    _interceptors[0].call(name, age);
    _interceptors[1].call(name, age);
    var _looper = (function () {
      var _loopAsync = false;
      var _loop;
      do {
        _loop = false;
        function _next0() {
          var _tap1 = _taps[1];
          _interceptors[0].tap(_tap1);
          _interceptors[1].tap(_tap1);
          var _fn1 = _x[1];
          var _hasResult1 = false;
          var _promise1 = _fn1(name, age);
          if (!_promise1 || !_promise1.then)
            throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
          _promise1.then((function (_result1) {
            _hasResult1 = true;
            if (_result1 !== undefined) {
              _loop = true;
              if (_loopAsync) _looper();
            } else {
              if (!_loop) {
                _interceptors[0].done();
                _interceptors[1].done();
                _resolve();
              }
            }
          }), function (_err1) {
            if (_hasResult1) throw _err1;
            _interceptors[0].error(_err1);
            _interceptors[1].error(_err1);
            _error(_err1);
          });
        }
        var _tap0 = _taps[0];
        _interceptors[0].tap(_tap0);
        _interceptors[1].tap(_tap0);
        var _fn0 = _x[0];
        var _hasResult0 = false;
        var _promise0 = _fn0(name, age);
        if (!_promise0 || !_promise0.then)
          throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise0 + ')');
        _promise0.then((function (_result0) {
          _hasResult0 = true;
          if (_result0 !== undefined) {
            _loop = true;
            if (_loopAsync) _looper();
          } else {
            _next0();
          }
        }), function (_err0) {
          if (_hasResult0) throw _err0;
          _interceptors[0].error(_err0);
          _interceptors[1].error(_err0);
          _error(_err0);
        });
      } while (_loop);
      _loopAsync = true;
    });
    _looper();
    _sync = false;
  }));
}
