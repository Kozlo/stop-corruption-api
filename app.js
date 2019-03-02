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

/**
 * Import custom controllers.
 */
const iubDataFetcher = require('./controllers/iub-data-fetcher');

//=================
// DB setup
//=================

const database = process.env.MONGODB_URI;

mongoose.Promise = global.Promise;
mongoose.connect(database, { useNewUrlParser: true }, () => console.log(`Successfully connected to the DB: ${database}`));
mongoose.connection.on('error', err => console.info(`Error: Could not connect to MongoDB ${database}: `, err));

//=================
// App setup
//=================

const app = express();
// Express middleware
app.use(helmet());
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

// Fetch IUB data
iubDataFetcher.fetchIUBData();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

const { logErrors, clientErrorHandler, errorHandler } = require('./errorHandlers');

app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);

module.exports = app;
