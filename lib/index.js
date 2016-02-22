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
var retry = require('./helpers/retry');

function APIGatewayImporter(doc, opts) {
  var options = opts || {};
  var apiOpts = extend(true, {
    region: 'us-east-1'
  }, (options.apigateway || {}));

  if (typeof doc === 'string') {
    doc = fs.readFileSync(path.resolve(doc), 'utf8');
  } else {
    doc = JSON.stringify(doc);
  }

  this.log = log.getLogger(Date.now().toString());
  this.log.setLevel(options.loglevel || 'info');
  this.swagger = JSON.parse(doc);
  this.gateway = new AWS.APIGateway(apiOpts);
  this.delay = options.delay || 400;
  this.paths = createPaths(this.swagger.paths);
  this.apiId = null;

  return this;
}

APIGatewayImporter.prototype.create = function create(next) {
  var _this = this;

  async.waterfall([
    function callGetApiId(callback) {
      _this.getApiId(function getApiIdCallback(err, exists) {
        var error;

        if (err) {
          return callback(err);
        }

        if (exists) {
          error = new Error('API with this name already exists.');
          error.name = 'AlreadyExistsException';

          return callback(error);
        }

        callback();
      });
    },
    function callCreateApi(callback) {
      _this.createApi(callback);
    },
    function callGetRootResource(callback) {
      _this.getRootResource(callback);
    },
    function callCreateResources(data, callback) {
      _this.createResources(data.id, _this.paths, callback);
    }
  ], function waterfallComplete(err) {
    if (err) {
      _this.log.error('Error creating API');
      return next(err);
    }

    _this.log.info('Creation complete');
    next(null, _this.apiId);
  });
};

APIGatewayImporter.prototype.createApi = function createApi(next) {
  var _this = this;

  var params = {
    name: this.swagger.info.title
  };

  this.log.info('Creating API: %s', params.name);
  this.gateway.createRestApi(params, function callCreateRestApi(err, data) {
    if (err) {
      return next(err);
    }

    _this.log.info('API Created: %s', data.id);
    _this.apiId = data.id;
    next();
  });
};

APIGatewayImporter.prototype.createResource = function createResource(resourcePath, methods, parentId, next, interval) {
  var _this = this;
  var params = {
    parentId: parentId,
    pathPart: resourcePath,
    restApiId: this.apiId
  };
  interval = interval || 1;

  // Skip creating a resource for the root path
  if (resourcePath === '/') {
    async.forEachOfSeries(getResourceMethods(methods), function forEachOfSeriesRootMethods(content, verb, callback) {
      _this.putMethod(content, verb.toUpperCase(), parentId, callback);
    }, next);

    return;
  }

  retry(this, 'createResource', params, function createResourceCallback(err, resource) {
    if (err) {
      _this.log.error('Error creating resource: %s', resourcePath);
      return next(err);
    }

    _this.log.info('Created resource: %s / %s', resourcePath, resource.id);
    async.forEachOfSeries(getResourceMethods(methods), function forEachOfSeriesresourceMethods(content, verb, callback) {
      _this.putMethod(content, verb.toUpperCase(), resource.id, callback);
    }, function completeSeries(completeErr) {
      next(completeErr, resource);
    });
  });
};

APIGatewayImporter.prototype.createResources = function createResources(parentId, paths, next) {
  var _this = this;

  async.forEachOf(paths, function forEachOfPaths(value, key, callback) {
    _this.createResource(key, value, parentId, function createResourceCallback(err, result) {
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

APIGatewayImporter.prototype.deploy = function deploy(next) {
  var _this = this;
  var params = {
    restApiId: this.apiId,
    stageName: this.swagger.basePath.slice(1)
  };

  retry(this, 'createDeployment', params, function createDeploymentCallback(err, data) {
    if (err) {
      _this.log.error('Error deploying API');
      return next(err);
    }

    _this.log.info('Deployed API');
    next(null, data);
  });
};

APIGatewayImporter.prototype.delete = function deleteApi(next) {
  var _this = this;
  var params = {
    restApiId: this.apiId
  };

  this.log.info('Deleting API: %s', this.apiId);
  retry(this, 'deleteRestApi', params, function deleteRestApiCallback(err, data) {
    if (err) {
      return next(err);
    }

    _this.apiId = null;
    next(null, data);
  });
};

APIGatewayImporter.prototype.deleteResource = function deleteResource(resourceId, next) {
  var params = {
    resourceId: resourceId,
    restApiId: this.apiId
  };

  this.log.info('Deleting resource:', resourceId);
  retry(this, 'deleteResource', params, next);
};

APIGatewayImporter.prototype.deleteResourceMethods = function deleteResourceMethods(resourceId, resourcePath, next) {
  var _this = this;
  var base = {
    resourceId: resourceId,
    restApiId: this.apiId
  };
  var pathObject = this.paths[resourcePath];
  var methods;

  if (!pathObject) {
    return next();
  }

  methods = Object.keys(pathObject).map(function mapMethods(key) {
    if (key !== 'paths') {
      return key.toUpperCase();
    }
  });

  async.eachSeries(methods, function eachSeriesMethods(resourceMethod, callback) {
    var params = extend({
      httpMethod: resourceMethod
    }, base);

    _this.log.debug('Deleting method: %s / %s', path, resourceMethod);
    retry(_this, 'deleteMethod', params, callback);
  }, next);
};

APIGatewayImporter.prototype.deleteResources = function deleteResources(next) {
  var _this = this;

  this.log.info('Deleting all API resources');
  this.getResources(function callGetResources(err, resources) {
    var rootId;
    var levelOne;

    if (err) {
      return next(err);
    }

    rootId = resources.items.filter(function filterRoot(item) {
      return item.path === '/';
    })[0].id;

    levelOne = resources.items.filter(function filterResources(item) {
      return item.parentId === rootId;
    });

    async.series([
      function callDeleteResourceMethods(callback) {
        _this.deleteResourceMethods(rootId, '/', callback);
      },
      function callDeleteResources(callback) {
        async.eachSeries(levelOne, function eachSeriesRootResources(item, cb) {
          _this.deleteResource(item.id, cb);
        }, callback);
      }
    ], function deleteComplete(completeErr) {
      return next(completeErr, rootId);
    });
  });
};

APIGatewayImporter.prototype.getApiId = function getApiId(next) {
  var _this = this;

  this.log.debug('Checking status of API');
  this.gateway.getRestApis(function callGetRestApis(err, data) {
    var match;

    if (err) {
      return next(err);
    }

    match = data.items.filter(function filterMatches(item) {
      return item.name === _this.swagger.info.title;
    });

    if (match.length) {
      _this.apiId = match[0].id;
    }

    next(null, _this.apiId);
  });
};

APIGatewayImporter.prototype.getResources = function getResources(next) {
  var params = {
    restApiId: this.apiId,
    limit: 500
  };

  this.log.debug('Getting resources for API');
  this.gateway.getResources(params, function callGatewayGetResources(err, data) {
    if (err) {
      return next(err);
    }

    next(null, data);
  });
};

APIGatewayImporter.prototype.getRootResource = function getRootResource(next) {
  var params = {
    restApiId: this.apiId,
    limit: 500
  };

  this.log.debug('Getting root resource for API');
  this.gateway.getResources(params, function callGatewayRootesources(err, data) {
    var rootItem;

    if (err) {
      return next(err);
    }

    rootItem = data.items.filter(function filterRoot(item) {
      return item.path === '/';
    })[0];

    next(null, rootItem);
  });
};

APIGatewayImporter.prototype.putIntegration = function putIntegration(content, verb, resourceId, next) {
  var params = integration(content, verb, resourceId, this.apiId);

  this.log.debug('Creating integration: %s / %s', resourceId, verb);
  retry(this, 'putIntegration', params, next);
};

APIGatewayImporter.prototype.putIntegrationResponses = function putIntegrationResponses(responses, verb, resourceId, next) {
  var _this = this;
  var iResponses = integrationResponses(responses, verb, resourceId, this.apiId);

  async.eachSeries(iResponses, function eachSeriesIntegrationResponses(params, callback) {
    _this.log.debug('Creating integration response: %s / %s / %s', resourceId, verb, params.selectionPattern);
    retry(_this, 'putIntegrationResponse', params, callback);
  }, next);
};

APIGatewayImporter.prototype.putMethod = function putMethod(content, verb, resourceId, next) {
  var _this = this;
  var xaws = 'x-amazon-apigateway-integration';

  function cm(fn, options, callback) {
    _this[fn](options, verb, resourceId, callback);
  }

  async.series([
    function callPutMethod(callback) {
      var params = method(content, verb, resourceId, _this.apiId);

      _this.log.debug('Creating method: %s / %s', resourceId, verb);
      retry(_this, 'putMethod', params, callback);
    },
    function callPutIntegration(callback) {
      var opts = {
        parameters: content.parameters || [],
        xaws: content[xaws]
      };

      cm('putIntegration', opts, callback);
    },
    function callPutMethodResponses(callback) {
      cm('putMethodResponses', content.responses || {}, callback);
    },
    function callPutIntegrationResponses(callback) {
      cm('putIntegrationResponses', content[xaws].responses || {}, callback);
    }
  ], next);
};

APIGatewayImporter.prototype.putMethodResponses = function putMethodResponses(responses, verb, resourceId, next) {
  var _this = this;
  var mResponses = methodResponses(responses, verb, resourceId, this.apiId);

  async.eachSeries(mResponses, function eachSeriesMethodResponses(params, callback) {
    _this.log.debug('Creating method response: %s / %s / %d', resourceId, verb, params.statusCode);
    retry(_this, 'putMethodResponse', params, callback);
  }, next);
};

APIGatewayImporter.prototype.updateApi = function updateApi(next) {
  var _this = this;

  this.deleteResources(function callDeleteResources(err, rootId) {
    if (err) {
      return next(err);
    }

    _this.createResources(rootId, _this.paths, next);
  });
};

module.exports = APIGatewayImporter;
