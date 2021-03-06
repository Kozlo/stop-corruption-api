const express = require('express');
const router = express.Router();
const { getAll } = require('../controllers/data');
const { fetchData } = require('../controllers/iub-data-fetcher');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json('Hello, hello!');
});

router.get('/data', getAll);
router.get('/fetch', fetchData);

module.exports = router;
