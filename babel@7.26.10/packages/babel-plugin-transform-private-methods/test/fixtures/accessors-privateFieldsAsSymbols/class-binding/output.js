var _A;
var _getA = Symbol("getA");
class A {
  constructor() {
    Object.defineProperty(this, _getA, {
      get: _get_getA,
      set: void 0
    });
  }
}
_A = A;
function _get_getA() {
  return _A;
}
