// NOTE: 路由拦截的简单实现
/**
 * Create a list of callbacks that can be reset. Used to create before and after navigation guards list
 */
export function useCallbacks<T>() {
  // NOTE: 拦截器队列
  let handlers: T[] = []

  // NOTE: 新增路由拦截器后 返回清除当前拦截的回掉函数
  function add(handler: T): () => void {
    handlers.push(handler)
    return () => {
      const i = handlers.indexOf(handler)
      if (i > -1) handlers.splice(i, 1)
    }
  }

  function reset() {
    handlers = []
  }

  return {
    add,
    list: () => handlers,
    reset,
  }
}
