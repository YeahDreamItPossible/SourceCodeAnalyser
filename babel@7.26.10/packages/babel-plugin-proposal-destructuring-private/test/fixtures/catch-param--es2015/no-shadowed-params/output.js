var _C;
var x;
var _x = /*#__PURE__*/new WeakMap();
class C {
  constructor() {
    babelHelpers.classPrivateFieldInitSpec(this, _x, void 0);
  }
}
_C = C;
(() => {
  x = "x";
  try {
    throw new _C();
  } catch (_e) {
    let x = babelHelpers.classPrivateFieldGet2(_x, _e);
  }
})();
