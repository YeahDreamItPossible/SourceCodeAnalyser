import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

// this._init
initMixin(Vue)
// data props
stateMixin(Vue)
// 事件
eventsMixin(Vue)
// this._update this.$forceUpdate this.$destroy
lifecycleMixin(Vue)
// this._o this._c this._e
// this.$nextTick this._render
renderMixin(Vue)

export default Vue
