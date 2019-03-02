const express = require('express');
const router = express.Router();
const { getAll } = require('../controllers/data');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json('Hello, hello!');
});

router.get('/data', getAll);

module.exports = router;
