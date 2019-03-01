/**
 * Model validation helpers.
 */

const mongoose = require('mongoose');
const helpers = require('./');

module.exports = {

    /**
     * Checks if the passed value is a positive integer.
     *
     * @public
     * @param {number} field Field value
     * @returns {boolean} Flag showing if the field is valid
     */
    isFieldPositiveInteger(field) {
        return typeof field === 'number' && field >= 0;
    },

    /**
     * Checks if values is a valid mongoose objectId.
     *
     * @public
     * @param {string} objectId
     * @returns {boolean} Flag showing if the field is valid
     */
    isObjectIdValid(objectId) {
        return objectId && mongoose.Types.ObjectId.isValid(objectId);
    }
};
