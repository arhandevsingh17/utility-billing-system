const express = require('express');
const router = express.Router();
const reader = require('../controllers/readerController');
const { isLoggedIn } = require('../middleware/auth');
const { hasRole } = require('../middleware/role');

// admin can view reader pages too, consumer cannot
router.use(isLoggedIn, hasRole('meterReader', 'admin'));

router.get('/dashboard', reader.dashboard);
router.get('/readings', reader.listReadings);
router.get('/readings/new', reader.newReadingForm);
router.post('/readings', reader.createReading);
router.get('/meters/:id/previous', reader.previousReadingJson);

module.exports = router;
