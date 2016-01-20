var extend = require('extend');

module.exports = function (methods) {
  methods = extend(true, {}, methods || {});
  delete methods.paths;

  return methods;
};