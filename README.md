# aws-apigateway-importer

Not quite port of [aws-apigateway-importer](https://github.com/awslabs/aws-apigateway-importer) for Node. It's still very limited in that it will only wholesale import/delete APIs, it also will only handle [Swagger](http://swagger.io/) JSON files.

## Usage

__\*\*DOES NOT CURRENTLY SUPPORT MANUUALY INCLUDING AWS CREDENTIALS. MUST BE PULLED FROM ENVIRONMENT OR `.aws` FOLDER\*\*__

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

### new constructor(path)

Reads the swagger json file and prepares the contents for API creation.

#### Arguments
1. __path__: Path to your Swagger file

### create(callback)

Creates the API, but does not deploy it to a server. The API name is pulled from `info.title` in the swagger.json file.

#### Arguments
1. __callback(err, result)__: Function to run after creation. 

### deploy(callback)

Deploys the API so that it is reachable via the internet. the `create` method must be called __before__ the `deploy` method.

The Stage name for the api is pulled from the `basePath` property of the swagger.json file and the leading `/` is removed.

#### Arguments
1. __callback(err, result)__: Function to run after deployment.

## ToDo
- [ ] Add unit tests
- [ ] Finer control of creation/deletion
- [ ] Allow updates
- [ ] Allow manual entry of AWS credentials

