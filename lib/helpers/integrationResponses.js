'use strict';

var extend = require('extend');
var integrationResponse = require('./integrationResponse');

module.exports = function integrationResponses(responses, method, resourceId, apiId) {
  var params = {
    httpMethod: method,
    resourceId: resourceId,
    restApiId: apiId
  };

  return Object.keys(responses).map(function mapResponses(selectionPattern) {
    return integrationResponse(responses[selectionPattern], selectionPattern, extend(true, {}, params));
  });
};
