// NOTE: 执行二次回调函数
function executeTwoCallbacks(promise, callback, errorCallback) {
  if (typeof callback === 'function') {
    promise.then(callback);
  }

  if (typeof errorCallback === 'function') {
    promise.catch(errorCallback);
  }
}

export default executeTwoCallbacks;
