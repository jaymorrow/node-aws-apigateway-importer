'use strict';

var extend = require('extend');
var methodResponse = require('./methodResponse');

module.exports = function  (responses, method, resourceId, apiId) {
  var params = {
    httpMethod: method,
    resourceId: resourceId,
    restApiId: apiId,
    responseParameters: {},
    responseModels: {}
  };

  return Object.keys(responses).map(function (statusCode) {
    return methodResponse(responses[statusCode], statusCode, extend(true, {}, params));
  });
}