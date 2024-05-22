const tapable = require('tapable')

const hook = new tapable.SyncHook(['name', 'age'], 'MySyncHook')

hook.tap({
	name: 'before',
	state: 10
}, (name, age) => {
	console.log('before: ', name, age)
})

hook.tap({
	name: 'after',
	stage: 20
}, (name, age) => {
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

	error (err) {
    console.log('intercept tap first: ', err)
	},

	result (result) {
    console.log('intercept tap first: ', result)
	},

	done () {
    console.log('intercept tap first: ', 'done')
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

  error (err) {
    console.log('intercept tap second: ', err)
	},

	result (result) {
    console.log('intercept tap second: ', result)
	},

	done () {
    console.log('intercept tap second: ', 'done')
	}
})

hook.call('Lee', 20)
// 输出:
// intercept register first
// intercept register first
// intercept register second
// intercept register second
// intercept call first:  Lee
// intercept call second:  Lee
// intercept tap first:  { type: 'sync', fn: [Function (anonymous)], name: 'before', state: 10 }
// intercept tap second:  { type: 'sync', fn: [Function (anonymous)], name: 'before', state: 10 }
// before:  Lee 20
// intercept tap first:  { type: 'sync', fn: [Function (anonymous)], name: 'after', stage: 20 }
// intercept tap second:  { type: 'sync', fn: [Function (anonymous)], name: 'after', stage: 20 }
// after:  Lee 20

console.log(hook.call.toString())
// 输出:
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
	_fn0(name, age);
	var _tap1 = _taps[1];
	_interceptors[0].tap(_tap1);
	_interceptors[1].tap(_tap1);
	var _fn1 = _x[1];
	_fn1(name, age);
}
