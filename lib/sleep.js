var DELAY = process.env.API_SLEEP_DELAY || 250;

module.exports = function (callback) {
  return function () {
    setTimeout(function () {
      callback();
    }, DELAY);
  }
};