'use strict';

var assert = require('assert');
var ApiImporter = require('../lib');
var swagger = require('../test-helpers/swagger.json');

swagger = JSON.parse(JSON.stringify(swagger).replace(/{{ACCOUNT_ID}}/g, process.env.ACCOUNT_ID));

describe('AWS Integration:', function () {
  context('Create / Delete', function () {
    var importer = new ApiImporter(swagger, {
      loglevel: 'silent'
    });

    it('should create API', function (done) {
      this.timeout(25000);

      importer.create(function (err, actual) {
        if (err) {
          console.log(err);
        }

        assert.ok(actual);
        done();
      });
    });

    it('should delete API', function (done) {
      importer.delete(function (err, actual) {
        if (err) {
          console.log(err);
        }

        assert.ok(actual);
        done();
      });
    })
  });

  context('Deploy API', function () {
    this.timeout(25000);
    var importer = new ApiImporter(swagger, {
      loglevel: 'silent'
    });

    afterEach('Delete API', function (done) {
      importer.delete(done);
    });

    it('should be successful', function (done) {
      importer.create(function (err, actual) {
        if (err) {
          console.log(err);
        }

        assert.ok(actual);

        importer.deploy(function (err, actual) {
          if (err) {
            console.log(err);
          }

          assert.ok(actual);
          done();
        });
      });
    });
  });
});