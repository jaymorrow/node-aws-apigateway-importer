'use strict';

var assert = require('assert');
var ApiImporter = require('../lib');
var swagger = require('../test-helpers/swagger.json');

swagger = JSON.parse(JSON.stringify(swagger).replace(/{{ACCOUNT_ID}}/g, process.env.ACCOUNT_ID));

describe('AWS Integration:', function () {
  context('Create / Delete API', function () {
    var importer = new ApiImporter(swagger, {
      loglevel: 'silent'
    });

    it('should create API', function (done) {
      this.timeout(20000);

      importer.create(function (err, actual) {
        if (err) {
          return done(err);
        }

        assert.ok(actual);
        assert.ok(importer.apiId);
        done();
      });
    });

    it('should delete API', function (done) {
      this.timeout(2000)
      importer.delete(function (err, actual) {
        if (err) {
          return done(err);
        }

        assert.ok(actual);
        assert.equal(importer.apiId, null);
        done();
      });
    })
  });

  context('Existing API', function () {
    var importer = new ApiImporter(swagger, {
      loglevel: 'silent'
    });

    var idStore;

    before('Create API', function (done) {
      this.timeout(20000);
      importer.create(function (err) {
        if (err) {
          return done(err);
        }

        idStore = importer.apiId;
        done();
      });
    });

    after('Delete API', function (done) {
      importer.apiId = idStore;
      importer.delete(done);
    });

    afterEach(function () {
      importer.apiId = null;
    });

    it('should return an API id', function (done) {
      importer.getApiId(function (err, id) {
        if (err) {
          return done(err);
        }

        assert.ok(id);
        done();
      });
    });

    it('should return an "AlreadyExistsException"', function (done) {
      importer.create(function (err, actual) {
        if (actual) {
          return done(actual);
        }

        assert.ok(err);
        assert.equal(err.name, 'AlreadyExistsException');
        assert.equal(err.message, 'API with this name already exists.');
        done();
      });
    });

    it('should be missing the API id', function (done) {
      importer.getResources(function (err, actual) {
        if (actual) {
          return done(actual);
        }

        assert.equal(err.code, 'MissingRequiredParameter');
        assert.equal(err.message, 'Missing required key \'restApiId\' in params');
        done();
      });
    });

    it('should return an array of resources', function (done) {
      importer.getApiId(function (err, id) {
        if (err) {
          return done(err);
        }

        assert.ok(id);

        importer.getResources(function (err, actual) {
          if (err) {
            return done(err);
          }

          assert.ok(actual.items);
          assert.ok(Array.isArray(actual.items));
          done();
        });
      });
    });

    it('should delete all resources', function (done) {
      this.timeout(20000);

      importer.getApiId(function (err, id) {
        if (err) {
          return done(err);
        }

        assert.ok(id);

        importer.deleteResources(function (err) {
          if (err) {
            return done(err);
          }

          importer.getResources(function (err, actual) {
            if (err) {
              return done(err);
            }

            assert.ok(actual.items);
            assert.equal(actual.items.length, 1);
            done();
          });
        });
      });
    });
  });

  context('Deploy API', function () {
    var importer = new ApiImporter(swagger, {
      loglevel: 'silent'
    });

    before('Create API', function (done) {
      this.timeout(20000);
      importer.create(done);
    });

    after('Delete API', function (done) {
      importer.delete(done);
    });

    it('should successfully create stage', function (done) {
      this.timeout(3000);
      importer.deploy(function (err, actual) {
        if (err) {
          return done(err);
        }

        assert.ok(actual);
        done();
      });
    });

    it('should deploy into an existing stage', function (done) {
      this.timeout(3000);
      importer.deploy(function (err, actual) {
        if (err) {
          return done(err);
        }

        assert.ok(actual);
        done();
      });
    });
  });

  context('Updating API', function () {
    var importer = new ApiImporter(swagger, {
      loglevel: 'silent'
    });

    before('Create API', function (done) {
      this.timeout(20000);
      importer.create(done);
    });

    after('Delete API', function (done) {
      importer.delete(done);
    });

    it('should replace all resources', function (done) {
      this.timeout(20000);

      importer.updateApi(function (err) {
        if (err) {
          return done(err);
        }

        done();
      });
    });
  });
});
