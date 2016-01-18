'use strict';

module.exports = function (content, method, resourceId, apiId) {
  var xaws = content.xaws;

  var params = {
    httpMethod: method,
    resourceId: resourceId,
    restApiId: apiId,
    type: xaws.type.toUpperCase(),
    integrationHttpMethod: xaws.httpMethod,
    requestParameters: {},
    requestTemplates: xaws.requestTemplates,
    uri: xaws.uri || '',
    credentials: xaws.credentials || null,
    cacheNamespace: xaws.cacheNamespace || '',
    cacheKeyParameters: []
  };

  if (content.parameters.length) {
    var cacheParams = (xaws.cacheKeyParameters || []).map(function (item) {
      return item.split('.').slice(-1)[0];
    });

    content.parameters.forEach(function (item) {
      var itemIn = item.in === 'query' ? 'querystring' : item.in;

      if (itemIn === 'body') {
        return;
      }

      if (cacheParams.indexOf(item.name) !== -1) {
        params.cacheKeyParameters.push('method.request.' + itemIn + '.' + item.name);
      }

      if (xaws.type.toUpperCase() === 'HTTP') {
        var key = '.request.' + itemIn + '.' + item.name;
        params.requestParameters['integration' + key] = 'method' + key;
      }
    });
  }

  return params;
}