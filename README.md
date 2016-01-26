# aws-apigateway-importer

[![Circle CI](https://circleci.com/gh/jaymorrow/node-aws-apigateway-importer.svg?style=shield)](https://circleci.com/gh/jaymorrow/node-aws-apigateway-importer)
[![Test Coverage](https://codeclimate.com/github/jaymorrow/node-aws-apigateway-importer/badges/coverage.svg)](https://codeclimate.com/github/jaymorrow/node-aws-apigateway-importer/coverage)
[![Code Climate](https://codeclimate.com/github/jaymorrow/node-aws-apigateway-importer/badges/gpa.svg)](https://codeclimate.com/github/jaymorrow/node-aws-apigateway-importer)

Not quite port of [aws-apigateway-importer](https://github.com/awslabs/aws-apigateway-importer) for Node. It's still very limited in that it will only wholesale import/delete APIs, it also will only handle [Swagger](http://swagger.io/) JSON files.

## Usage

See the _example_ folder included in the repo for the swagger.json file.

```js
var ApiImporter = require('aws-apigateway-importer');
var importer = new ApiImporter('swagger.json');

importer.create(function (err, result) {
  if (err) {
    return console.error(err);
  }

  importer.deploy(function (err, result) {
    if (err) {
      return console.error(err);
    }
    console.log(result);
  });
});
```

If at anytime the deployment is unsuccessful due to an error the partially created API will be deleted.

## Methods

### new constructor(doc[, options])

Reads the swagger json file and prepares the contents for API creation.

#### Arguments
1. __doc__ (_String_ | _Object_): The path to the Swagger file of a JavaScript object that has the same format as a swagger file.
2. [__options__] \(_Object_): Configuration options for the AWS ApiGateway service.
    * loglevel (_String_): `debug`, `info`, `error`. See [Loglevel](http://pimterry.github.io/loglevel/) for more information.
    * delay (_Number_): The time in milliseconds to wait between adding integrations and responses to resources.
    * apigateway (_Object_): Any option available on the [API Gateway constructor](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/APIGateway.html#constructor-property).

### create(callback)

Creates the full API (methods, integrations, etc), but does not deploy it to a server. The API name is pulled from `info.title` in the swagger.json file.

#### Arguments
1. __callback(err, result)__ (_Function_): Run after creation. 

### deploy(callback)

Deploys the API so that it is reachable via the internet. the `create` method must be called __before__ the `deploy` method.

The Stage name for the api is pulled from the `basePath` property of the swagger.json file and the leading `/` is removed.

#### Arguments
1. __callback(err, result)__ (_Function_): Run after deployment.

### updateApi(callback)

Deletes all methods and resources on an existing API and recreates it from the Swagger configuration. 

** Even if methods have the same path and signature they will have new resource IDs. This is a destructive operation for everything but the parent API. **

#### Arguments
1. __callback(err, result)__ (_Function_): Run after creation. 
