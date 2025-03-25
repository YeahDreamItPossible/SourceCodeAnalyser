"use strict";

let Base = /*#__PURE__*/babelHelpers.createClass(function Base() {
  babelHelpers.classCallCheck(this, Base);
});
let value = 2;
let Obj = /*#__PURE__*/function (_Base) {
  function Obj() {
    babelHelpers.classCallCheck(this, Obj);
    return babelHelpers.callSuper(this, Obj, arguments);
  }
  babelHelpers.inherits(Obj, _Base);
  return babelHelpers.createClass(Obj, [{
    key: "test",
    set: function (v) {
      expect(this).toBe(obj);
      value = v;
    }
  }, {
    key: "set",
    value: function set() {
      return babelHelpers.superPropSet(Obj, "test", 3, this, 1, 1);
    }
  }]);
}(Base);
const obj = new Obj();
expect(obj.set()).toBe(3);
expect(Base.prototype.test).toBeUndefined();
expect(Obj.prototype.test).toBeUndefined();
expect(value).toBe(2);
expect(obj.test).toBe(3);
