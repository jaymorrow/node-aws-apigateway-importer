'use strict';

var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var extend = require('extend');
var async = require('async');
var log = require('loglevel');

var createPaths = require('./createPaths');
var integration = require('./integration');
var integrationResponses = require('./integrationResponses');
var method = require('./method');
var methodResponses = require('./methodResponses');
var sleep = require('./sleep');

var apigateway;

function createAPI(info, next) {
  var params = {
    name: info.title
  };

  log.info('Creating API: %s', info.title);
  apigateway.createRestApi(params, function (err, data) {
    if (err) {
      return next(err);
    }

    log.info('API Created: %s', data.id);
    next(null, data);
  });
}

function createResource(path, methods, parentId, apiId, next) {
  var params = {
    parentId: parentId,
    pathPart: path,
    restApiId: apiId
  };

  // Skip creating a resource for the root path
  if (path === '/') {
    async.forEachOfSeries(getResourceMethods(methods), function (content, verb, callback) {
      putMethod(content, verb.toUpperCase(), parentId, apiId, callback);
    }, next);

    return;
  }

  log.info('Creating resource: %s', path);
  apigateway.createResource(params, function (err, resource) {
    if (err) {
      return next(err);
    }

    async.forEachOfSeries(getResourceMethods(methods), function (content, verb, callback) {
      putMethod(content, verb.toUpperCase(), resource.id, apiId, callback);
    }, function (err) {
      next(err, resource);
    });
  });
}

function createResources(apiId, parentId, paths, next) {
  async.forEachOfSeries(paths, function (value, key, callback) {
    createResource(key, value, parentId, apiId, function (err, result) {
      if (err) {
        return callback(err);
      }

      if (result && value.paths) {
        return createResources(apiId, result.id, value.paths, callback);
      }

      callback();
    });
  }, next);
}

function getResourceMethods(methods) {
  methods = extend(true, {}, methods || {});
  delete methods.paths;

  return methods;
}

function getRootResource(id, next) {
  var params = {
    restApiId: id,
    limit: 1,
  };

  log.debug('Getting root resource for API');
  apigateway.getResources(params, function (err, data) {
    if (err) {
      return next(err);
    }

    next(null, data);
  });
}

function putIntegration(content, verb, resourceId, apiId, next) {
  var params = integration(content, verb, resourceId, apiId);

  log.debug('Creating integration: %s', verb);
  apigateway.putIntegration(params, sleep(next));
}

function putIntegrationResponses(responses, verb, resourceId, apiId, next) {
  var iResponses = integrationResponses(responses, verb, resourceId, apiId);

  async.eachSeries(iResponses, function (params, callback) {
    log.debug('Creating integration response: %s', params.selectionPattern);
    apigateway.putIntegrationResponse(params, sleep(callback));
  }, next);
}

function putMethod(content, verb, resourceId, apiId, next) {
  function cm(fn, options, callback) {
    fn(options, verb, resourceId, apiId, callback);
  }

  var xaws = 'x-amazon-apigateway-integration';

  async.series([
    function (callback) {
      log.info('Creating method: %s', verb);

      var params = method(content, verb, resourceId, apiId);
      apigateway.putMethod(params, sleep(callback));
    },
    function (callback) {
      var opts = {
        parameters: content.parameters || [],
        xaws: content[xaws]
      };

      cm(putIntegration, opts, callback);
    },
    function (callback) {
      cm(putMethodResponses, content.responses || {}, callback);
    },
    function (callback) {
      cm(putIntegrationResponses, content[xaws].responses || {}, callback);
    }
  ], next);
}

function putMethodResponses(responses, verb, resourceId, apiId, next) {
  var mResponses = methodResponses(responses, verb, resourceId, apiId);

  async.eachSeries(mResponses, function (params, callback) {
    log.debug('Creating method response: %d', params.statusCode);
    apigateway.putMethodResponse(params, sleep(callback));
  }, next);
}

function APIGatewayImporter(doc, opts) {
  opts = opts || {};

  apigateway = new AWS.APIGateway({
    region: opts.region || 'us-east-1'
  });

  log.setLevel(opts.loglevel || 'info');

  if (typeof doc === 'string') {
    this.swagger = JSON.parse(fs.readFileSync(path.resolve(doc), 'utf8'));
  } else {
    this.swagger = doc;
  }

  this.paths = createPaths(this.swagger.paths);
  this.apiId = null;

  return this;
}

APIGatewayImporter.prototype.create = function (next) {
  var _this = this;

  async.waterfall([
    function (callback) {
      createAPI(_this.swagger.info, callback);
    },
    function (data, callback) {
      _this.apiId = data.id;
      getRootResource(_this.apiId, callback);
    },
    function (data, callback) {
      createResources(_this.apiId, data.items[0].id, _this.paths, callback);
    }
  ], function (err) {
    if (err) {
      log.error('Error creating API');
      return next(err);
    }

    log.info('Creation complete');
    next(null, _this.apiId);
  });
};

APIGatewayImporter.prototype.deploy = function (next) {
  var _this = this;
  var params = {
    restApiId: this.apiId,
    stageName: this.swagger.basePath.slice(1)
  };

  apigateway.createDeployment(params, function (err, data) {
    if (err) {
      log.error('Error deploying API');
      return next(err);
    }

    log.info('Deployed API');
    next(null, data);
  });
};

APIGatewayImporter.prototype.delete = function (next) {
  var params = {
    restApiId: this.apiId
  };

  log.info('Deleting API: %s', this.apiId);
  apigateway.deleteRestApi(params, function (err, data) {
    if (err) {
      return next(err);
    }

    next(null, data);
  });
}

module.exports = APIGatewayImporter;