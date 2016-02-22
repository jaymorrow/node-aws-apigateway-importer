'use strict';
var extend = require('extend');

module.exports = function getResourceMethods(methods) {
  methods = extend(true, {}, methods || {});
  delete methods.paths;

  return methods;
};
