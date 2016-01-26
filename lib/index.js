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
    doc = fs.readFileSync(path.resolve(doc), 'utf8');
  } else {
    doc = JSON.stringify(doc);
  }

  this.log = log.getLogger(Date.now().toString());
  this.log.setLevel(opts.loglevel || 'info');
  this.swagger = JSON.parse(doc);
  this.gateway = new AWS.APIGateway(apiOpts);
  this.delay = opts.delay || 250;
  this.paths = createPaths(this.swagger.paths);
  this.apiId = null;

  return this;
}

APIGatewayImporter.prototype.create = function (next) {
  var _this = this;

  async.waterfall([
    function (callback) {
      _this.getApiId(function (err, exists) {
        if (err) {
          return callback(err);
        }

        if (exists) {
          var err = new Error('API with this name already exists.');
          err.name = 'AlreadyExistsException';

          return callback(err);
        }

        callback();
      });
    },
    function (callback) {
      _this.createApi(callback);
    },
    function (callback) {
      _this.getRootResource(callback);
    },
    function (data, callback) {
      _this.createResources(data.id, _this.paths, callback);
    }
  ], function (err) {
    if (err) {
      _this.log.error('Error creating API');
      return next(err);
    }

    _this.log.info('Creation complete');
    next(null, _this.apiId);
  });
};

APIGatewayImporter.prototype.createApi = function (next) {
  var _this = this;

  var params = {
    name: this.swagger.info.title
  };

  this.log.info('Creating API: %s', params.name);
  this.gateway.createRestApi(params, function (err, data) {
    if (err) {
      return next(err);
    }

    _this.log.info('API Created: %s', data.id);
    _this.apiId = data.id;
    next();
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

  this.log.info('Creating resource: %s', path);
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
      _this.log.error('Error deploying API');
      return next(err);
    }

    _this.log.info('Deployed API');
    next(null, data);
  });
};

APIGatewayImporter.prototype.delete = function (next) {
  var _this = this;
  var params = {
    restApiId: this.apiId
  };

  this.log.info('Deleting API: %s', this.apiId);
  this.gateway.deleteRestApi(params, function (err, data) {
    if (err) {
      return next(err);
    }

    _this.apiId = null;
    next(null, data);
  });
};

APIGatewayImporter.prototype.deleteResource = function (resourceId, next) {
  this.log.info('Deleting resource:', resourceId);
  var params = {
    resourceId: resourceId,
    restApiId: this.apiId
  };

  this.gateway.deleteResource(params, next);
};

APIGatewayImporter.prototype.deleteResourceMethods = function (resourceId, path, next) {
  var _this = this;
  var base = {
    resourceId: resourceId,
    restApiId: this.apiId
  };
  var pathObject = this.paths[path];

  if (!pathObject) {
    return next();
  }

  var methods = Object.keys(pathObject).map(function (key) {
    if (key !== 'paths') {
      return key.toUpperCase();
    }
  });

  this.log.info('Deleting methods on:', path);
  async.eachSeries(methods, function (method, callback) {
    var params = extend({
      httpMethod: method
    }, base);

    _this.log.debug('Deleting method:', method);
    _this.gateway.deleteMethod(params, sleep(function (err) {
      if (err) {
        return callback(err);
      }

      callback();
    }, _this.delay));
  }, next);
};

APIGatewayImporter.prototype.deleteResources = function (next) {
  var _this = this;

  this.log.info('Deleting all API resources');
  this.getResources(function (err, resources) {
    if (err) {
      return next(err);
    }

    var rootId = resources.items.filter(function (item) {
      return item.path === '/';
    })[0].id;

    var levelOne = resources.items.filter(function (item) {
      return item.parentId === rootId;
    });

    async.series([
      function (callback) {
        _this.deleteResourceMethods(rootId, '/', callback);
      },
      function (callback) {
        async.eachSeries(levelOne, function (item, cb) {
          _this.deleteResource(item.id, cb);
        }, callback);
      }
    ], function (err) {
      return next(err, rootId);
    });
  });
};

APIGatewayImporter.prototype.getApiId = function (next) {
  var _this = this;

  this.log.debug('Checking status of API');
  this.gateway.getRestApis(function (err, data) {
    if (err) {
      return next(err);
    }

    var match = data.items.filter(function (item) {
      return item.name === _this.swagger.info.title;
    });

    if (match.length) {
      _this.apiId = match[0].id;
    }

    next(null, _this.apiId);
  });
};

APIGatewayImporter.prototype.getResources = function (next) {
  var params = {
    restApiId: this.apiId,
    limit: 500
  };

  this.log.debug('Getting resources for API');
  this.gateway.getResources(params, function (err, data) {
    if (err) {
      return next(err);
    }

    next(null, data);
  });
};

APIGatewayImporter.prototype.getRootResource = function (next) {
  var params = {
    restApiId: this.apiId,
    limit: 500
  };

  this.log.debug('Getting root resource for API');
  this.gateway.getResources(params, function (err, data) {
    if (err) {
      return next(err);
    }

    var root = data.items.filter(function (item) {
      return item.path === '/';
    })[0];

    next(null, root);
  });
};

APIGatewayImporter.prototype.putIntegration = function (content, verb, resourceId, next) {
  var params = integration(content, verb, resourceId, this.apiId);

  this.log.debug('Creating integration: %s', verb);
  this.gateway.putIntegration(params, sleep(next, this.delay));
};

APIGatewayImporter.prototype.putIntegrationResponses = function (responses, verb, resourceId, next) {
  var _this = this;
  var iResponses = integrationResponses(responses, verb, resourceId, this.apiId);

  async.eachSeries(iResponses, function (params, callback) {
    _this.log.debug('Creating integration response: %s', params.selectionPattern);
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
      _this.log.info('Creating method: %s', verb);

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
    _this.log.debug('Creating method response: %d', params.statusCode);
    _this.gateway.putMethodResponse(params, sleep(callback, _this.delay));
  }, next);
};

APIGatewayImporter.prototype.updateApi = function (next) {
  var _this = this;

  this.deleteResources(function (err, rootId) {
    if (err) {
      return next(err);
    }

    _this.createResources(rootId, _this.paths, next);
  });
}

module.exports = APIGatewayImporter;
