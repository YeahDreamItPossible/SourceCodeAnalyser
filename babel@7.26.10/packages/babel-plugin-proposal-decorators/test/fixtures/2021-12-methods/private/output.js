let _initProto, _call_a;
const dec = () => {};
class Foo {
  static {
    [_call_a, _initProto] = babelHelpers.applyDecs(this, [[dec, 2, "a", function () {
      return this.value;
    }]], []);
  }
  #a = _call_a;
  value = (_initProto(this), 1);
  callA() {
    return this.#a();
  }
}
