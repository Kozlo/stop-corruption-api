/**
 * Configurable properties used throughout the app.
 */

/**
 * IUB FTP Connection Information.
 */
const IUB = {
  ftpHostname: 'open.iub.gov.lv',
  IUBLocalDataDirectory: `${__dirname}/iub_data`,
  minYear: '2013',
};

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

const monthStrings = {
    '01': {
        num: 0,
        en: 'January',
        lv: 'Janvāris',
    },
    '02': {
        num: 1,
        en: 'February',
        lv: 'Februāris',
    },
    '03': {
        num: 2,
        en: 'March',
        lv: 'Marts',
    },
    '04': {
        num: 3,
        en: 'April',
        lv: 'Aprīlis',
    },
    '05': {
        num: 4,
        en: 'May',
        lv: 'Maijs',
    },
    '06': {
        num: 5,
        en: 'June',
        lv: 'Jūnijs',
    },
    '07': {
        num: 6,
        en: 'July',
        lv: 'Jūlijs',
    },
    '08': {
        num: 7,
        en: 'August',
        lv: 'Augusts',
    },
    '09': {
        num: 8,
        en: 'September',
        lv: 'Septembris',
    },
    '10': {
        num: 9,
        en: 'October',
        lv: 'Oktobris',
    },
    '11': {
        num: 10,
        en: 'November',
        lv: 'Novembris',
    },
    '12': {
        num: 11,
        en: 'December',
        lv: 'Decembris',
    }
};


const dayStrings = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'];
const countryCodes = {
    '1': {
        en: 'Latvia',
        lv: 'Latvija',
    },
};

const currencyCodes = {
    '1': 'LVL',
    '2': 'EUR',
};

module.exports = { httpStatusCodes, errorStatusCodes, monthStrings, dayStrings, IUB, };
