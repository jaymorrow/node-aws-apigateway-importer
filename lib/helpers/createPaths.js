'use strict';

var extend = require('extend');

module.exports = function (paths) {
  var tree = {}

  Object.keys(paths).forEach(function (key) {
    var route = tree;
    var segments;

    if (key === '/') {
      segments = [key];
    } else {
      segments = key.slice(1).split('/');
    }

    segments.forEach(function (part, index, arr) {
      if (index === arr.length - 1) {
        if (route[part]) {
          extend(route[part], paths[key]);
        } else {
          route[part] = paths[key];
        }
      } else {
        if (route[part] && !route[part].paths) {
          route[part].paths = {};
        }

        if (!route[part]) {
          route[part] = {};
          route[part].paths = {};
        }

        route = route[part].paths;
      }
    });
  });

  return tree;
}
