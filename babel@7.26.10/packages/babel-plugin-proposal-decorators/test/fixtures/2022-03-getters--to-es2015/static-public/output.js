var _Foo;
let _initStatic;
const dec = () => {};
class Foo {
  static get a() {
    return this.value;
  }
  static get ['b']() {
    return this.value;
  }
}
_Foo = Foo;
(() => {
  [_initStatic] = babelHelpers.applyDecs2203R(_Foo, [[dec, 8, "a"], [dec, 8, 'b']], []).e;
  _initStatic(_Foo);
})();
babelHelpers.defineProperty(Foo, "value", 1);
