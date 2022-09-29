/* @flow */

import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'

export function installRenderHelpers (target: any) {
  target._o = markOnce
  target._n = toNumber // 转换成 Number
  target._s = toString  // 转换成 String
  target._l = renderList // renderList
  target._t = renderSlot // 渲染slot
  target._q = looseEqual // 比较
  target._i = looseIndexOf // findIndexInArray
  target._m = renderStatic // 渲染静态节点
  target._f = resolveFilter // 渲染过滤器
  target._k = checkKeyCodes
  target._b = bindObjectProps
  target._v = createTextVNode // 文本节点
  target._e = createEmptyVNode // 
  target._u = resolveScopedSlots // 
  target._g = bindObjectListeners
  target._d = bindDynamicKeys
  target._p = prependModifier
}
