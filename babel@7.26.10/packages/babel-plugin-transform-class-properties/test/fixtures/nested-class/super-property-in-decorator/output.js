"use strict";

let Hello = /*#__PURE__*/function () {
  function Hello() {
    babelHelpers.classCallCheck(this, Hello);
  }
  return babelHelpers.createClass(Hello, [{
    key: "dec",
    value: function dec() {
      return () => "hello";
    }
  }]);
}();
let Outer = /*#__PURE__*/function (_Hello) {
  function Outer() {
    var _Inner;
    let _init_hello, _init_extra_hello;
    var _this;
    babelHelpers.classCallCheck(this, Outer);
    _this = babelHelpers.callSuper(this, Outer);
    let Inner = /*#__PURE__*/babelHelpers.createClass(function Inner() {
      babelHelpers.classCallCheck(this, Inner);
      babelHelpers.defineProperty(this, "hello", _init_hello(this));
      _init_extra_hello(this);
    });
    _Inner = Inner;
    [_init_hello, _init_extra_hello] = babelHelpers.applyDecs2311(_Inner, [], [[babelHelpers.superPropGet((_this, Outer), "dec", _this, 1), 0, "hello"]]).e;
    return babelHelpers.possibleConstructorReturn(_this, new Inner());
  }
  babelHelpers.inherits(Outer, _Hello);
  return babelHelpers.createClass(Outer);
}(Hello);
expect(new Outer().hello).toBe('hello');
