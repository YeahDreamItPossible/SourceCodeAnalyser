var _bar = /*#__PURE__*/babelHelpers.classPrivateFieldLooseKey("bar");
var Foo = /*#__PURE__*/function (_Bar) {
  "use strict";

  function Foo() {
    var _this;
    babelHelpers.classCallCheck(this, Foo);
    foo((_this = babelHelpers.callSuper(this, Foo), Object.defineProperty(babelHelpers.assertThisInitialized(_this), _bar, {
      writable: true,
      value: "foo"
    }), babelHelpers.assertThisInitialized(_this)));
    return _this;
  }
  babelHelpers.inherits(Foo, _Bar);
  return babelHelpers.createClass(Foo);
}(Bar);
