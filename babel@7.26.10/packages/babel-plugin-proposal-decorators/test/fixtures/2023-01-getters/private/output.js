let _initProto, _call_a;
const dec = () => {};
class Foo {
  static {
    [_call_a, _initProto] = babelHelpers.applyDecs2301(this, [[dec, 3, "a", function () {
      return this.value;
    }]], [], _ => #a in _).e;
  }
  value = (_initProto(this), 1);
  get #a() {
    return _call_a(this);
  }
  getA() {
    return this.#a;
  }
}
