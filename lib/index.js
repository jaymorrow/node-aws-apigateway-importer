'use strict';

var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var extend = require('extend');
var async = require('async');
var log = require('loglevel');

// Helpers
var createPaths = require('./helpers/createPaths');
var getResourceMethods = require('./helpers/getResourceMethods');
var integration = require('./helpers/integration');
var integrationResponses = require('./helpers/integrationResponses');
var method = require('./helpers/method');
var methodResponses = require('./helpers/methodResponses');
var sleep = require('./helpers/sleep');

function APIGatewayImporter(doc, opts) {
  opts = opts || {};

  var apiOpts = extend(true, {
    region: 'us-east-1'
  }, (opts.apigateway || {}));

  if (typeof doc === 'string') {
    this.swagger = JSON.parse(fs.readFileSync(path.resolve(doc), 'utf8'));
  } else {
    this.swagger = doc;
  }

  this.gateway = new AWS.APIGateway(apiOpts);
  this.delay = opts.delay || 250;
  this.paths = createPaths(this.swagger.paths);
  this.apiId = null;
  log.setLevel(opts.loglevel || 'info');

  return this;
}

APIGatewayImporter.prototype.create = function (next) {
  var _this = this;

  async.waterfall([
    function (callback) {
      _this.createAPI(callback);
    },
    function (data, callback) {
      _this.apiId = data.id;
      _this.getRootResource(callback);
    },
    function (data, callback) {
      _this.createResources(data.items[0].id, _this.paths, callback);
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

APIGatewayImporter.prototype.createAPI = function (next) {
  var params = {
    name: this.swagger.info.title
  };

  log.info('Creating API: %s', params.name);
  this.gateway.createRestApi(params, function (err, data) {
    if (err) {
      return next(err);
    }

    log.info('API Created: %s', data.id);
    next(null, data);
  });
};

APIGatewayImporter.prototype.createResource = function (path, methods, parentId, next) {
  var _this = this;
  var params = {
    parentId: parentId,
    pathPart: path,
    restApiId: this.apiId
  };

  // Skip creating a resource for the root path
  if (path === '/') {
    async.forEachOfSeries(getResourceMethods(methods), function (content, verb, callback) {
      _this.putMethod(content, verb.toUpperCase(), parentId, callback);
    }, next);

    return;
  }

  log.info('Creating resource: %s', path);
  this.gateway.createResource(params, function (err, resource) {
    if (err) {
      return next(err);
    }

    async.forEachOfSeries(getResourceMethods(methods), function (content, verb, callback) {
      _this.putMethod(content, verb.toUpperCase(), resource.id, callback);
    }, function (err) {
      next(err, resource);
    });
  });
};

APIGatewayImporter.prototype.createResources = function (parentId, paths, next) {
  var _this = this;

  async.forEachOfSeries(paths, function (value, key, callback) {
    _this.createResource(key, value, parentId, function (err, result) {
      if (err) {
        return callback(err);
      }

      if (result && value.paths) {
        return _this.createResources(result.id, value.paths, callback);
      }

      callback();
    });
  }, next);
};

APIGatewayImporter.prototype.deploy = function (next) {
  var _this = this;
  var params = {
    restApiId: this.apiId,
    stageName: this.swagger.basePath.slice(1)
  };

  this.gateway.createDeployment(params, function (err, data) {
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
  this.gateway.deleteRestApi(params, function (err, data) {
    if (err) {
      return next(err);
    }

    next(null, data);
  });
};

APIGatewayImporter.prototype.getRootResource = function (next) {
  var params = {
    restApiId: this.apiId,
    limit: 1
  };

  log.debug('Getting root resource for API');
  this.gateway.getResources(params, function (err, data) {
    if (err) {
      return next(err);
    }

    next(null, data);
  });
};

APIGatewayImporter.prototype.putIntegration = function (content, verb, resourceId, next) {
  var params = integration(content, verb, resourceId, this.apiId);

  log.debug('Creating integration: %s', verb);
  this.gateway.putIntegration(params, sleep(next, this.delay));
};

APIGatewayImporter.prototype.putIntegrationResponses = function (responses, verb, resourceId, next) {
  var _this = this;
  var iResponses = integrationResponses(responses, verb, resourceId, this.apiId);

  async.eachSeries(iResponses, function (params, callback) {
    log.debug('Creating integration response: %s', params.selectionPattern);
    _this.gateway.putIntegrationResponse(params, sleep(callback, _this.delay));
  }, next);
};

APIGatewayImporter.prototype.putMethod = function (content, verb, resourceId, next) {
  var _this = this;

  function cm(fn, options, callback) {
    _this[fn](options, verb, resourceId, callback);
  }

  var xaws = 'x-amazon-apigateway-integration';

  async.series([
    function (callback) {
      log.info('Creating method: %s', verb);

      var params = method(content, verb, resourceId, _this.apiId);
      _this.gateway.putMethod(params, sleep(callback, _this.delay));
    },
    function (callback) {
      var opts = {
        parameters: content.parameters || [],
        xaws: content[xaws]
      };

      cm('putIntegration', opts, callback);
    },
    function (callback) {
      cm('putMethodResponses', content.responses || {}, callback);
    },
    function (callback) {
      cm('putIntegrationResponses', content[xaws].responses || {}, callback);
    }
  ], next);
}

APIGatewayImporter.prototype.putMethodResponses = function (responses, verb, resourceId, next) {
  var _this = this;
  var mResponses = methodResponses(responses, verb, resourceId, this.apiId);

  async.eachSeries(mResponses, function (params, callback) {
    log.debug('Creating method response: %d', params.statusCode);
    _this.gateway.putMethodResponse(params, sleep(callback, _this.delay));
  }, next);
};

module.exports = APIGatewayImporter;