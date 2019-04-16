/**
 * Common helpers.
 */

const config = require('../config');

const { httpStatusCodes } = config;
const mongoError = 'MongoError';
const mongoDupKeyErrorCode = 11000;

module.exports = {
    /**
     * Checks if the passed string is valid.
     * Also trips the spaces from the start/end to check if the string is not empty.
     *
     * @param {*} val Value to check.
     * @returns {boolean} Flag showing is the value is a valid string.
     */
    isValidString(val) {
        return typeof val === 'string' && val.trim() !== '';
    },

    /**
     * Checks if the passed value has type undefined.
     *
     * @param {*} val Value to check.
     * @returns {boolean} Flag showing is the value is undefined.
     */
    isTypeUndefined(val) {
        return typeof val === 'undefined';
    },

    /**
     * Converts the argument to a date and checks if the result is a valid date.
     *
     * @public
     * @param {Date} date Date to check
     * @returns {boolean} Flag showing if the value is a valid date
     */
    isValidDate(date) {
        return date instanceof Date && date.toString() !== 'Invalid Date';
    },

    /**
     * Checks if the error is a duplicate key error.
     *
     * If this error occurs then the entry already exists.
     *
     * @param err {Object} Error
     * @returns {Object|boolean} Error or false
     */
    entryExistsError(err) {
        if (err.name === mongoError && err.code === mongoDupKeyErrorCode) {
            const message = 'Entry already exists.';

            return this.createError(message, httpStatusCodes.conflict);
        }

        return false;
    },

    /**
     * Removes the passed item from the specified array.
     *
     * @public
     * @param {*} item Item to remove
     * @param {Array} array Array to use
     * @returns {Array} Updated array
     */
    removeItemFromArray(item, array) {
        const itemIndex = array.indexOf(item);

        if (itemIndex > -1) {
            array.splice(itemIndex, 1);
        }

        return array;
    },

    /**
     * Checks if the passed value is a valid URL.
     *
     * @public
     * @param {string} url URL to check
     * @returns {boolean} Flag showing if the value is a valid URL
     */
    isUrlValid(url) {
        const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;

        return pattern.test(url);
    },

    /**
     * Attempts to parse the passed body.
     *
     * @param {string} body Stringified JSON.
     * @returns {object} Object body
     */
    parseBody(body) {
        let parsedBody;

        try {
            parsedBody = JSON.parse(body);
        } catch (e) {
            console.error('Error parsing body.', e);
        }

        return parsedBody;
    },

    /**
     * Extracts filters, sorters and config from query params.
     *
     * Instantiates them to empty objects if they are not defined.
     * Additionally parses the limit to an int if it's present or sets to 0 (i.e. get all resutls)
     *
     * @param {Object} queryParams Request query parameters.
     * @returns {Object} Query parameters
     */
    parseQueryParams(queryParams) {
        let {
            filters,
            sorters,
            limit
        } = queryParams;

        limit = limit ? parseInt(limit, 10) : 0;
        filters = typeof filters === 'string' ? JSON.parse(filters) : {};
        sorters = typeof sorters === 'string' ? JSON.parse(sorters) : {};

        for (let prop in filters) {
            if (typeof filters[prop] === 'string') {
                filters[prop] = new RegExp(filters[prop]);
            }
        }

        return { filters, sorters, limit };
    },

    /**
     * Checks if the
     * @param {Date} dateToCheck Date to check against
     * @returns {boolean} Flag showing if the fetched date is today
     */
    isToday(dateToCheck) {
        const fetchedDateDate = dateToCheck.getDate();
        const fetchedDateMonth = dateToCheck.getMonth();
        const fetchedDateYear = dateToCheck.getFullYear();

        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        return fetchedDateYear === todayYear && fetchedDateMonth === todayMonth && fetchedDateDate === todayDate;
    },
    /**
     * Gets the date for the fetcher in it's format.
     * @param {int} days Days back in past to subtract.
     */
    getFetcherDate(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);

        return {
          day: getParsedDateNumber(date.getDate()),
          month: getParsedDateNumber(date.getMonth() + 1),
          year: date.getFullYear().toString(),
        };
    },
    propNameFinder,
    getParsedDateNumber,
};

/**
 * Checks for missing properties in found date by comparing an existing object.
 *
 * Skips objects with _text properties as those are just string.
 * Skips empty objects.
 *
 * @param obj
 * @param comparisonObj
 * @param parentProp
 * @returns {*}
 */
function propNameFinder(obj, comparisonObj, parentProp = '') {
    for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            const val = obj[prop];
            const compVal = comparisonObj[prop];

            if (prop === '_text') {
                return;
            }

            if (compVal === undefined) {
                console.log(`Property ${parentProp}."${prop}" undefined:`, val);
            } else if (typeof val === 'object' && typeof val._text !== 'string' && JSON.stringify(val) !== JSON.stringify({})) {
                if (typeof compVal !== 'object') {
                    return console.log(`Property ${parentProp}.${prop} is an object ${JSON.stringify(val)}, but the comparison value is not:`, compVal);
                } else {
                    return propNameFinder(val, comparisonObj[prop], `${parentProp}.${prop}`);
                }
            }
        }
    }
}

/**
 * Converts the date pr month number to a date string (e.g. 01 or 30).
 *
 * @param {int} dateNumber Date number
 * @returns {string} Date string
 */
function getParsedDateNumber(dateNumber) {
    return dateNumber < 10 ? `0${dateNumber}` : dateNumber.toString();
}
