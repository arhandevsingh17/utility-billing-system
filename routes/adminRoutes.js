const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { isLoggedIn } = require('../middleware/auth');
const { hasRole } = require('../middleware/role');

router.use(isLoggedIn, hasRole('admin'));

router.get('/dashboard', admin.dashboard);

router.get('/consumers', admin.listConsumers);
router.get('/consumers/new', admin.newConsumerForm);
router.post('/consumers', admin.createConsumer);
router.get('/consumers/:id/edit', admin.editConsumerForm);
router.put('/consumers/:id', admin.updateConsumer);

router.get('/meters', admin.listMeters);
router.get('/meters/new', admin.newMeterForm);
router.post('/meters', admin.createMeter);
router.put('/meters/:id/toggle', admin.toggleMeter);

router.get('/tariffs', admin.listTariffs);
router.get('/tariffs/new', admin.newTariffForm);
router.post('/tariffs', admin.createTariff);
router.put('/tariffs/:id/activate', admin.activateTariff);

router.get('/readers', admin.listReaders);
router.get('/readers/new', admin.newReaderForm);
router.post('/readers', admin.createReader);

router.get('/bills', admin.listBills);

module.exports = router;
