/**
 * App.js
 *
 * Entry point for the Anti-Corruption CRM application.
 */

  //=================
  // Dependencies
  //=================

const createError = require('http-errors');
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Import custom controllers.
 */
const { fetchIUBData } = require('./controllers/iub-data-fetcher');
const { getFetcherDate, getLursoftSession, getLursoftSessionRequestUrl } = require('./helpers');

/**
 * Helpers.
 */
const { msToHours } = require('./helpers');

/**
 * Other constants
 */
const FETCHER_DAYS = 150; // how many days in the past should the fetcher check entries for
const FETCH_TIMEOUT = 1; // wait 1 day until fetching again

//=================
// DB setup
//=================

const database = process.env.MONGODB_URI;

mongoose.Promise = global.Promise;
mongoose.connect(database, { useNewUrlParser: true })
  .then(() => console.log(`Successfully connected to the DB: ${database}`));
mongoose.connection.on('error', err => console.info(`Error: Could not connect to MongoDB ${database}: `, err));

//=================
// App setup
//=================

const app = express();
// Express middleware
app.use(helmet());
app.use(cors());
app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//=================
// Routes
//=================

const routes = require('./routes');
app.use('/', routes);

//=================
// Error handling
//=================

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

const { logErrors, clientErrorHandler, errorHandler } = require('./errorHandlers');

app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);

// fetch data for the last week on start-up as well as every day
const { year, month, day } = getFetcherDate(FETCHER_DAYS);

fetchIUBData(year, month, day);

// if (process.env.NODE_ENV.toUpperCase() !== 'DEV') {
//   console.log(`Initiating fetching data at an interval of ${msToHours(FETCH_TIMEOUT)} hours.`);
//   setInterval(() => {
//     fetchIUBData(year, month, day);
//   }, FETCH_TIMEOUT);
// }

module.exports = app;
