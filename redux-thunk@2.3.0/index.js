function createThunkMiddleware(extraArgument) {
  return function thunk({ dispatch, getState }) {
    return function (_dispatch) {
      // 对_dispatch函数进行包装
      return function (action) {
        // 控制反转IOC
        if (typeof action === 'function') {
          return action(dispatch, getState, extraArgument);
        }
    
        return _dispatch(action);
      }
    }
  }
}

const thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

export default thunk;
