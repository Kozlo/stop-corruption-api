/**
 * Groups controller.
 */

const config = require('../config');

const IubEntry = require('../models/iubEntry');

const helpers = require('../helpers');
const { httpStatusCodes } = config;

module.exports = {

  /**
   * Retrieves all entries.
   *
   * @public
   * @param {Object} req Request object
   * @param {Object} res Response object
   * @param {Function} next Executes the next matching route
   */
  getAll(req, res, next) {
    const { filters, sorters, limit } = helpers.parseQueryParams(req.query);

    IubEntry.find(filters)
      .sort(sorters)
      .limit(limit)
      .then(entries => res.status(httpStatusCodes.ok).json(entries))
      .catch(err => next(err));
  },
  
};
