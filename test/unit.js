'use strict';

var assert = require('assert');
var createPaths = require('../lib/helpers/createPaths');
var swagger = require('../test-helpers/swagger.json');

describe.only('Helpers', function () {
  context('createPaths', function () {
    var actual = createPaths(swagger.paths);

    context('1st level', function () {
      it('should have two keys', function () {
        assert.equal(Object.keys(actual).length, 2);
      });

      it('should contain a root object', function () {
        var root = actual['/'];

        assert.ok(root);
        assert.equal(typeof root, 'object');
        assert.equal(typeof root.paths, 'undefined');
      });

      it('should have a user object', function () {
        var user = actual.user;

        assert.ok(user);
        assert.equal(typeof user, 'object');
        assert.ok(user.paths);
        assert.equal(typeof user.paths, 'object');
      });
    });

    context('user object', function () {
      var user = actual.user;

      it('should have three keys', function () {
        assert.equal(Object.keys(user).length, 3);
      });

      it('should contain a \'paths\' object', function () {
        assert.ok(user.paths);
        assert.equal(typeof user.paths, 'object');
      });
    });
  });
});