'use strict';

var extend = require('extend');
var integrationResponse = require('./integrationResponse');

module.exports = function (responses, method, resourceId, apiId, next) {
  var params = {
    httpMethod: method,
    resourceId: resourceId,
    restApiId: apiId
  };

  return Object.keys(responses).map(function (selectionPattern) {
    return integrationResponse(responses[selectionPattern], selectionPattern, extend(true, {}, params));
  });
}