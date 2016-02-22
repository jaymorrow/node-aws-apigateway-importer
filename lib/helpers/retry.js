'use strict';

module.exports = function retry(context, fn, params, next, interval) {
  interval = interval || 1;

  context.gateway[fn](params, function gatewayFunction(err, result) {
    if (err && err.statusCode === 429) {
      return setTimeout(retry, context.delay * interval, context, fn, params, next, interval + 1);
    } else if (err) {
      return next(err);
    }

    next(null, result);
  });
};
