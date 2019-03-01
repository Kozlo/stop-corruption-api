/**
 * Model validation helpers.
 */

const mongoose = require('mongoose');
const { monthStrings } = require('../config');

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
    },

    /**
     * Checks if the value is a valid year
     *
     * @public
     * @param {string} year
     * @returns {boolean} Flag showing if the field is valid
     */
    isValidYear(year) {
        const parsedYear = parseInt(year);

        return typeof year === 'string' &&
          !isNaN(parsedYear) &&
          mongoose.Types.Number.isValid(parsedYear) &&
          Math.round(parsedYear).toString() === year &&
          parsedYear > 1000 &&
          parsedYear < 3000;
    },

    /**
     * Checks if the value is a valid month
     *
     * @public
     * @param {string} month
     * @returns {boolean} Flag showing if the field is valid
     */
    isValidMonth(month) {
        return typeof month === 'string' &&
          monthStrings[month];
    },

    /**
     * Checks if the value is a valid dau
     *
     * @public
     * @param {string} day
     * @returns {boolean} Flag showing if the field is valid
     */
    isValidDay(day) {
        return typeof day === 'string' &&
          monthStrings.find(dayString => dayString === day);
    },

    /**
     * Checks if the value is a valid dau
     *
     * @public
     * @param {string} day
     * @returns {boolean} Flag showing if the field is valid
     */
    isValidTimestamp(timestamp) {
        return new Date(timestamp) !== 'Invalid Date' &&
          mongoose.Types.Date.isValid(timestamp);
    },
};
