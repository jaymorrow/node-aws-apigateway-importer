var DELAY = 250;

module.exports = function (callback) {
  return function () {
    setTimeout(function () {
      callback();
    }, DELAY);
  }
};