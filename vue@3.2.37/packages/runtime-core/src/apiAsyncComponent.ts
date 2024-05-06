import {
  Component,
  ConcreteComponent,
  currentInstance,
  ComponentInternalInstance,
  isInSSRComponentSetup,
  ComponentOptions
} from './component'
import { isFunction, isObject } from '@vue/shared'
import { ComponentPublicInstance } from './componentPublicInstance'
import { createVNode, VNode } from './vnode'
import { defineComponent } from './apiDefineComponent'
import { warn } from './warning'
import { ref } from '@vue/reactivity'
import { handleError, ErrorCodes } from './errorHandling'
import { isKeepAlive } from './components/KeepAlive'
import { queueJob } from './scheduler'

export type AsyncComponentResolveResult<T = Component> = T | { default: T } // es modules

export type AsyncComponentLoader<T = any> = () => Promise<
  AsyncComponentResolveResult<T>
>

export interface AsyncComponentOptions<T = any> {
  loader: AsyncComponentLoader<T>
  loadingComponent?: Component
  errorComponent?: Component
  delay?: number
  timeout?: number
  suspensible?: boolean
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number
  ) => any
}

export const isAsyncWrapper = (i: ComponentInternalInstance | VNode): boolean =>
  !!(i.type as ComponentOptions).__asyncLoader

// NOTE: 定义异步组件
export function defineAsyncComponent<
  T extends Component = { new (): ComponentPublicInstance }
>(source: AsyncComponentLoader<T> | AsyncComponentOptions<T>): T {
  if (isFunction(source)) {
    source = { loader: source }
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout, // undefined = never times out
    suspensible = true,
    onError: userOnError
  } = source

  // NOTE: 正在等待中的请求(防止多次重复加载,因为有重试机制)
  let pendingRequest: Promise<ConcreteComponent> | null = null

  // NOTE: 动态加载的组件数据
  let resolvedComp: ConcreteComponent | undefined

  // NOTE: 重新加载异步组件次数
  let retries = 0

  // NOTE: 重新异步加载(重试机制)
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }

  const load = (): Promise<ConcreteComponent> => {
    let thisRequest: Promise<ConcreteComponent>
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            err = err instanceof Error ? err : new Error(String(err))
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                // NOTE: 正常加载异步组件失败(非耗时)后 则回调用户onError函数
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              throw err
            }
          })
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`
              )
            }
            // interop module default
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            resolvedComp = comp
            return comp
          }))
    )
  }

  return defineComponent({
    name: 'AsyncComponentWrapper',

    __asyncLoader: load,

    get __asyncResolved() {
      return resolvedComp
    },

    setup() {
      const instance = currentInstance!

      // already resolved
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp!, instance)
      }

      const onError = (err: Error) => {
        pendingRequest = null
        handleError(
          err,
          instance,
          ErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */
        )
      }

      // suspense-controlled or SSR.
      if (
        (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
        (__SSR__ && isInSSRComponentSetup)
      ) {
        return load()
          .then(comp => {
            return () => createInnerComp(comp, instance)
          })
          .catch(err => {
            onError(err)
            return () =>
              errorComponent
                ? createVNode(errorComponent as ConcreteComponent, {
                    error: err
                  })
                : null
          })
      }

      // NOTE: 标识: 动态组件加载成功
      const loaded = ref(false)

      // NOTE: 
      const error = ref()

      // NOTE: 是否延时展示加载组件
      const delayed = ref(!!delay)

      // NOTE: 如果有延时 则在延时时间后展示 加载组件
      if (delay) {
        setTimeout(() => {
          delayed.value = false
        }, delay)
      }

      // 加载耗时则直接报错
      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }

      load()
        .then(() => {
          loaded.value = true
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            // parent is keep-alive, force update so the loaded component's
            // name is taken into account
            queueJob(instance.parent.update)
          }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      // 首先: 异步组件 错误组件 加载组件都有可能是异步组件
      // 其次: 有delay参数
      // 所以: 至于展示哪个组件 取决于当前组件加载速度 展示优先级: 异步组件 => 错误组件 => 加载组件
      return () => {
        if (loaded.value && resolvedComp) {
          // 展示异步组件
          return createInnerComp(resolvedComp, instance)
        } 
        else if (error.value && errorComponent) {
          // 展示错误组件
          return createVNode(errorComponent as ConcreteComponent, {
            error: error.value
          })
        } 
        else if (loadingComponent && !delayed.value) {
          // 展示加载组件
          return createVNode(loadingComponent as ConcreteComponent)
        }
      }
    }
  }) as T
}

function createInnerComp(
  comp: ConcreteComponent,
  {
    vnode: { ref, props, children, shapeFlag },
    parent
  }: ComponentInternalInstance
) {
  const vnode = createVNode(comp, props, children)
  // ensure inner component inherits the async wrapper's ref owner
  vnode.ref = ref
  return vnode
}
