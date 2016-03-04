'use strict';

module.exports = function integrationResponse(content, selectionPattern, params) {
  var responseParameters = content.responseParameters && Object.keys(content.responseParameters);

  params.statusCode = content.statusCode;
  params.responseTemplates = content.responseTemplates || {};
  params.selectionPattern = selectionPattern === 'default' ? '-' : selectionPattern;
  params.responseParameters = content.responseParameters;

  return params;
};
