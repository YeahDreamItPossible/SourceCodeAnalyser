var _A;
var _getA = Symbol("getA");
class A {
  constructor() {
    Object.defineProperty(this, _getA, {
      value: _getA2
    });
  }
}
_A = A;
function _getA2() {
  return _A;
}
