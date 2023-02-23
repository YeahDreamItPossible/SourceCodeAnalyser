// TODO: 目前来看 好像是vnode 标识
export const enum ShapeFlags {
  ELEMENT = 1,
  
  // NOTE: 函数式组件 2
  FUNCTIONAL_COMPONENT = 1 << 1,

  // NOTE: 状态式组件 4
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,

  // NOTE: 组件(函数式组件 || 状态式组件)
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}
