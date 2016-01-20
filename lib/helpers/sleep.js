module.exports = function (callback, delay) {
  return function () {
    setTimeout(function () {
      callback();
    }, delay);
  }
};