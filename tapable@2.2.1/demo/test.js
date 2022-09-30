const SyncBailHook = require('../lib/SyncBailHook')

const hooks = new SyncBailHook(['name'])

// 注册事件
hooks.tap('MyHook', (name) => console.log(1))
hooks.tap('MyHook', (name) => {
	console.log(2)
	return 'over'
})
hooks.tap('MyHook', (name) => console.log(3))


// 调用事件
hooks.call('Lee')

console.log(hooks.call.toString())

function anonymous(name) {
	"use strict";
	var _context;
	var _x = this._x;
	var _fn0 = _x[0];
	var _result0 = _fn0(name);
	if (_result0 !== undefined) {
		return _result0;;
	} else {
		var _fn1 = _x[1];
		var _result1 = _fn1(name);
		if (_result1 !== undefined) {
			return _result1;;
		} else {
			var _fn2 = _x[2];
			var _result2 = _fn2(name);
			if (_result2 !== undefined) {
				return _result2;;
			} else {}
		}
	}

}
