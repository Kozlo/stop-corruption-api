/**
 * Error handlers.
 */

const { errorStatusCodes, httpStatusCodes } = require('./config');

module.exports = {
    /**
     * Logs the caught error to the console and calls the next method.
     *
     * @public
     * @param {Error} err Error
     * @param {Object} req Request object
     * @param {Object} res Response object
     * @param {Function} next Method for continuing execution
     */
    logErrors(err, req, res, next) {
        console.error(`${err.name} error:`, err);
        next(err);
    },

    /**
     * Tries to identify the type of error and send a response with the appropriate error status code.
     *
     * @public
     * @param {Error} err Error
     * @param {Object} req Request object
     * @param {Object} res Response object
     * @param {Function} next Method for continuing execution
     * @returns {*}
     */
    clientErrorHandler(err, req, res, next) {
        const { name, status } = err;
        const statusCode = status || errorStatusCodes[name];

        if (typeof statusCode === 'undefined') {
            return next(err);
        } else if (!res.headersSent) {
            res.status(statusCode).json(err);
        }
    },

    /**
     * Checks if the headers have been sent and if not, sends the response.
     *
     * Checks if the error has a status code. Uses 500 if none is found.
     *
     * @public
     * @param {Error} err Error
     * @param {Object} req Request object
     * @param {Object} res Response object
     * @param {Function} next Method for continuing execution
     */
    errorHandler(err, req, res, next) {
        if (res.headersSent) return next(err);

        const status = err.status || httpStatusCodes.internalServerError;

        res.status(status).json({
            message: 'An unexpected error occurred',
            error: err
        });
    }
};
