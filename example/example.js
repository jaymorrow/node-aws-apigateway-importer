var ApiImporter = require('aws-apigateway-importer');
var importer = new ApiImporter('./swagger.json');

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