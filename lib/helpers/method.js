'use strict';

var extend = require('extend');

function setAuthorization(params, security) {
  var authorizationType = 'NONE';
  var apiKeyRequired = false;

  params = extend(true, {}, params);

  if (security) {
    security.forEach(function forEachSecurity(item) {
      if (item.sigv4) {
        return authorizationType = 'AWS_IAM';
      }

      if (item.api_key) {
        return apiKeyRequired = true;
      }
    });
  }

  params.authorizationType = authorizationType;
  params.apiKeyRequired = apiKeyRequired;

  return params;
}

function setRequestModels(params, consumes, items) {
  params = extend(true, {}, params);
  params.requestModels = {};

  items.forEach(function forEachItems(item) {
    params.requestModels[consumes] = item.name;
  });

  return params;
}

function setRequestParameters(params, contentParameters) {
  params = extend(true, {}, params);
  params.requestParameters = {};

  contentParameters.forEach(function forEachContentParameters(item) {
    var itemIn = item.in === 'query' ? 'querystring' : item.in;

    var key = 'method.request.' + itemIn + '.' + item.name;
    params.requestParameters[key] = item.required;
  });

  return params;
}

module.exports = function createMethod(content, method, resourceId, apiId) {
  var params = {
    httpMethod: method,
    resourceId: resourceId,
    restApiId: apiId
  };
  var models;
  var contentParameters;

  params = setAuthorization(params, content.security);

  if (content.parameters && content.parameters.length) {
    models = content.parameters.filter(function filterModels(item) {
      return item.in === 'body';
    });

    contentParameters = content.parameters.filter(function filterParameters(item) {
      return item.in !== 'body';
    });

    params = setRequestModels(params, content.consumes, models);
    params = setRequestParameters(params, contentParameters);
  }

  return params;
};
