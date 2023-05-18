// tapAsync

// callAsync
function anonymous(name, age, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  function _next0() {
    var _fn1 = _x[1];
    _fn1(name, age, (function (_err1) {
      if (_err1) {
        _callback(_err1);
      } else {
        _callback();
      }
    }));
  }
  var _fn0 = _x[0];
  _fn0(name, age, (function (_err0) {
    if (_err0) {
      _callback(_err0);
    } else {
      _next0();
    }
  }));
}

// promise
function anonymous(name, age) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function (_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if (_sync)
        _resolve(Promise.resolve().then((function () { throw _err; })));
      else
        _reject(_err);
    };
    function _next0() {
      var _fn1 = _x[1];
      _fn1(name, age, (function (_err1) {
        if (_err1) {
          _error(_err1);
        } else {
          _resolve();
        }
      }));
    }
    var _fn0 = _x[0];
    _fn0(name, age, (function (_err0) {
      if (_err0) {
        _error(_err0);
      } else {
        _next0();
      }
    }));
    _sync = false;
  }));
}

// tapPromise

// tapAsync
function anonymous(name, age, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  function _next0() {
    var _fn1 = _x[1];
    var _hasResult1 = false;
    var _promise1 = _fn1(name, age);
    if (!_promise1 || !_promise1.then)
      throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
    _promise1.then((function (_result1) {
      _hasResult1 = true;
      _callback();
    }), function (_err1) {
      if (_hasResult1) throw _err1;
      _callback(_err1);
    });
  }
  var _fn0 = _x[0];
  var _hasResult0 = false;
  var _promise0 = _fn0(name, age);
  if (!_promise0 || !_promise0.then)
    throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise0 + ')');
  _promise0.then((function (_result0) {
    _hasResult0 = true;
    _next0();
  }), function (_err0) {
    if (_hasResult0) throw _err0;
    _callback(_err0);
  });
}

// tapPromise
function anonymous(name, age) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function (_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if (_sync)
        _resolve(Promise.resolve().then((function () { throw _err; })));
      else
        _reject(_err);
    };
    function _next0() {
      var _fn1 = _x[1];
      var _hasResult1 = false;
      var _promise1 = _fn1(name, age);
      if (!_promise1 || !_promise1.then)
        throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
      _promise1.then((function (_result1) {
        _hasResult1 = true;
        _resolve();
      }), function (_err1) {
        if (_hasResult1) throw _err1;
        _error(_err1);
      });
    }
    var _fn0 = _x[0];
    var _hasResult0 = false;
    var _promise0 = _fn0(name, age);
    if (!_promise0 || !_promise0.then)
      throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise0 + ')');
    _promise0.then((function (_result0) {
      _hasResult0 = true;
      _next0();
    }), function (_err0) {
      if (_hasResult0) throw _err0;
      _error(_err0);
    });
    _sync = false;
  }));
}