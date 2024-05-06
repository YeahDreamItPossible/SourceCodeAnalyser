function createThunkMiddleware(extraArgument) {
  return ({ dispatch, getState }) => next => action => {
    // 控制反转IOC
    if (typeof action === 'function') {
      return action(dispatch, getState, extraArgument);
    }

    return next(action);
  };
}

const thunk = createThunkMiddleware();
thunk.withExtraArgument = createThunkMiddleware;

export default thunk;
