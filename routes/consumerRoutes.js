const express = require('express');
const router = express.Router();
const consumer = require('../controllers/consumerController');
const { isLoggedIn } = require('../middleware/auth');
const { hasRole } = require('../middleware/role');

router.use(isLoggedIn, hasRole('consumer'));

router.get('/dashboard', consumer.dashboard);
router.get('/bill', consumer.currentBill);
router.get('/bills', consumer.listBills);
router.get('/bills/:id', consumer.billDetail);
router.post('/bills/:id/pay', consumer.payBill);
router.get('/consumption', consumer.consumption);

module.exports = router;
