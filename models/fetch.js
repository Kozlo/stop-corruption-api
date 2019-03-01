const mongoose = require('mongoose');
const validators = require('../helpers/modelValidators');

/**
 * Schema properties.
 *
 * @property {String} year Year of the fetch
 * @property {String} month Month of the fetch
 * @property {String} day Day of the fetch
 * @property {Date} fetchedAt Timestamp of the fetch
 */
const properties = {
    year: {
        type: String,
        required: true,
        validate: {
            validator: validators.isValidYear,
            message: '{VALUE} is not a valid year string'
        }
    },
    month: {
        type: String,
        required: true,
        validate: {
            validator: validators.isValidMonth,
            message: '{VALUE} is not a valid month string'
        }
    },
    day: {
        type: String,
        required: true,
        validate: {
            validator: validators.isValidDay,
            message: '{VALUE} is not a valid day string'
        }
    },
    fetchedAt: {
        type: Date,
        required: true,
        validate: {
            validator: validators.isValidTimestamp,
            message: '{VALUE} is not a valid timestamp'
        }
    },
};

const schema = new mongoose.Schema(properties);

module.exports = mongoose.model('IUBDataFetch', schema);
