// 自定义转换vnode args (预处理vnode)
// 如果设置该转换函数 则会先调用该转换函数 后调用_createVNode函数
let vnodeArgsTransformer;
function transformVNodeArgs(transformer) {
  vnodeArgsTransformer = transformer;
}

function createVNodeWithAgrsTransform(...args) {
  return _createVNode(...(vnodeArgsTransformer ? vnodeArgsTransformer(...args) : _createVNode(...args)))
}

function _createVNode(...args) {
  return createBaseVNode(...args)
}

function createVNode() {
  return createVNodeWithAgrsTransform
}

function createBaseVNode() {
  const vnode = {}

  return vnode
}

function createAppContext() {
  return ({
    app: null,
    config: {},
    mixins: [],
    components: [],
    directives: {},
    provides: {}
  })
}

function createAppAPI(render) {
  return function createApp(rootCompnent, rootProps) {
    const context = createAppContext()

    let isMounted = false;

    const app = context.app = {
      _instance: null,
      _context: context,
      _component: rootCompnent,
      _container: nul,

      use() {},
      component() {},
      directive() {},
      provide() {},
      mixin() {},
      mount(rootContainer) {
        if (!isMounted) {
          // 挂载
          const vnode = createVNode(rootCompnent, rootProps)
          vnode.appContext = context

          render(vnode, rootCompnent)
          isMounted = true
          vnode._container = rootContainer
          rootContainer.__vue_app__ = app

          return getExposeProxy(vnode.component) || vnode.component.proxy
        }
        else {
          // 更新
        }
      },
      unmount() {}
    }

    return app
  }
}

// 标识:
const Fragment = Symbol('Fragment')
const Text = Symbol('Text')
const Comment = Symbol('Comment')
const Static = Symbol('Static')


function baseCreateRender(options) {
  // patch
  // 将 vnode 转换成 dom 的函数

  const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
    // n1 旧vnode
    // n2 新vnode
    if (n1 === n2) return

    if (n1 && !isSameVNodeType(n1, n2)) {
      unmount(n1, parentComponent)
      n1 = nul
    }

    const { type, ref, shapeFlag } = n2
    switch(type) {
      case Text: 
        processText(n1, n2, container, anchor)
        break
      case Comment:
        processCommentNode(n1, n2, container, anchor)
        break
      case Static:

      case Fragment:
        processFragment(n1, n2, container, anchor, parentComponent)
        break
      default:
        

    }
  }

  const processText = () => {}

  const processCommentNode = () => {}

  const unmount = () => {}

  const render = (vnode, container) => {
    if (vnode == null) {
      // 卸载
      if (container._vnode) {
        unmount(container._vnode)
      }
    }
    else {
      // 挂载
      patch(container._vnode || null, vnode, container)
    }
    container._vnode = vnode
  }

  return ({
    render,
    createApp: createAppAPI(render)
  })

}

function createRender(options) {
  return baseCreateRender(options)
}

let renderer = null
function ensureRenderer() {
  // 此时renderOptions是与DOM操作相关(平台属性)
  return renderer || (renderer = createRender(renderOptions))
}

function createApp(...args) {
  const app = ensureRenderer().createApp(...args)
  const { mount } = app
  app.mount = function (container) {
    const _container = container
    _container.innerHTML = ''
    const proxy = mount(_container)
    return proxy
  }
}