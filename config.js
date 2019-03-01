/**
 * Configurable properties used throughout the app.
 */


/**
 * HTTP status codes.
 */
const httpStatusCodes = {
    ok: 200,
    created: 201,
    noContent: 204,
    movedPermanently: 301,
    notModified: 304,
    badRequest: 400,
    unauthorized: 401,
    forbidden: 403,
    notFound: 404,
    conflict: 409,
    internalServerError: 500,
    notImplemented: 501,
    serviceUnavailable: 503
};

/**
 * Defined error status codes.
 */
const errorStatusCodes = {
    'BadRequestError': httpStatusCodes.badRequest,
    'ConflictError': httpStatusCodes.conflict,
    'ForbiddenError': httpStatusCodes.forbidden,
    'UnauthorizedError': httpStatusCodes.unauthorized,
    'ValidationError': httpStatusCodes.badRequest
};

module.exports = { httpStatusCodes, errorStatusCodes, };
