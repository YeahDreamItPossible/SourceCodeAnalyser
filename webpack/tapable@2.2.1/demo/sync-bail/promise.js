const tapable = require('tapable')

const hook = new tapable.SyncBailHook(['name', 'age'], 'MySyncBailHook')

hook.tap({
	name: 'before'
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

hook.promise('Lee', 20).then(() => {
	console.log('over')
}).catch(err => {
	console.log('over error: ', err)
})

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
// over

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
    var _tap0 = _taps[0];
    _interceptors[0].tap(_tap0);
    _interceptors[1].tap(_tap0);
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      var _result0 = _fn0(name, age);
    } catch (_err) {
      _hasError0 = true;
      _error(_err);
    }
    if (!_hasError0) {
      if (_result0 !== undefined) {
        _resolve(_result0);
        ;
      } else {
        var _tap1 = _taps[1];
        _interceptors[0].tap(_tap1);
        _interceptors[1].tap(_tap1);
        var _fn1 = _x[1];
        var _hasError1 = false;
        try {
          var _result1 = _fn1(name, age);
        } catch (_err) {
          _hasError1 = true;
          _error(_err);
        }
        if (!_hasError1) {
          if (_result1 !== undefined) {
            _resolve(_result1);
            ;
          } else {
            var _tap2 = _taps[2];
            _interceptors[0].tap(_tap2);
            _interceptors[1].tap(_tap2);
            var _fn2 = _x[2];
            var _hasError2 = false;
            try {
              var _result2 = _fn2(name, age);
            } catch (_err) {
              _hasError2 = true;
              _error(_err);
            }
            if (!_hasError2) {
              if (_result2 !== undefined) {
                _resolve(_result2);
                ;
              } else {
                _resolve();
              }
            }
          }
        }
      }
    }
    _sync = false;
  });
}