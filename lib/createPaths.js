'use strict';

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
      if (route[part] && !route[part].paths) {
        route[part].paths = {};
      } else if (!route[part]) {
        route[part] = paths[key];
      }

      route = route[part].paths || route[part];
    });
  });

  return tree;
}