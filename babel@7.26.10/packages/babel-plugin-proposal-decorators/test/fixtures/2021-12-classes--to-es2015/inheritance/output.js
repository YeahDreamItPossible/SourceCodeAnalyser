var _Bar2, _Foo2;
let _initClass, _initClass2;
const dec1 = () => {};
const dec2 = () => {};
let _Bar;
class Bar {}
_Bar2 = Bar;
[_Bar, _initClass] = babelHelpers.applyDecs(_Bar2, [], [dec1]);
_initClass();
let _Foo;
class Foo extends _Bar {}
_Foo2 = Foo;
[_Foo, _initClass2] = babelHelpers.applyDecs(_Foo2, [], [dec2]);
_initClass2();
