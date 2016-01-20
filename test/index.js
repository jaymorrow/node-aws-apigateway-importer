'use strict';

var assert = require('assert');
var ApiImporter = require('../lib');
var swagger = require('../test-helpers/swagger.json');

var ACCOUNT_ID = process.env.ACCOUNT_ID;
var swagger = JSON.parse(JSON.stringify(swagger).replace(/{{ACCOUNT_ID}}/g, ACCOUNT_ID));

describe('AWS Integration:', function () {
  context('Create API', function () {
    this.timeout(25000);
    var importer = new ApiImporter(swagger, {
      loglevel: 'silent'
    });

    afterEach('Delete API', function (done) {
      importer.delete(done);
    });

    it('should be successful', function (done) {
      importer.create(function (err, result) {
        if (err) {
          console.log(err);
        }

        assert.ok(result);
        done();
      });
    });
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
      importer.create(function (err, result) {
        if (err) {
          console.log(err);
        }

        assert.ok(result);

        importer.deploy(function (err, data) {
          if (err) {
            console.log(err);
          }

          assert.ok(data);
          done();
        });
      });
    });
  });
});