// call
function anonymous(name, age) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0]; 
  _fn0(name, age);
  var _fn1 = _x[1];
  _fn1(name, age);
}

// callAsync
function anonymous(name, age, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _hasError0 = false;
  try {
    _fn0(name, age);
  } catch (_err) {
    _hasError0 = true;
    _callback(_err);
  }
  if (!_hasError0) {
    var _fn1 = _x[1];
    var _hasError1 = false;
    try {
      _fn1(name, age);
    } catch (_err) {
      _hasError1 = true;
      _callback(_err);
    }
    if (!_hasError1) {
      _callback();
    }
  }
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
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      _fn0(name, age);
    } catch (_err) {
      _hasError0 = true;
      _error(_err);
    }
    if (!_hasError0) {
      var _fn1 = _x[1];
      var _hasError1 = false;
      try {
        _fn1(name, age);
      } catch (_err) {
        _hasError1 = true;
        _error(_err);
      }
      if (!_hasError1) {
        _resolve();
      }
    }
    _sync = false;
  }));
}