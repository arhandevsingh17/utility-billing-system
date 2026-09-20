const User = require('../models/User');
const Meter = require('../models/Meter');
const Tariff = require('../models/Tariff');
const Reading = require('../models/Reading');
const Bill = require('../models/Bill');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { refreshBillStatuses } = require('../utils/helpers');

// ---------- dashboard ----------

exports.dashboard = catchAsync(async (req, res) => {
  await refreshBillStatuses();

  const totals = await Bill.aggregate([
    { $group: { _id: null, totalBills: { $sum: 1 }, totalUnits: { $sum: '$unitsConsumed' }, totalBilled: { $sum: '$totalAmount' } } }
  ]);

  const statusCounts = await Bill.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }
  ]);

  const topConsumers = await Bill.aggregate([
    { $group: { _id: '$consumer', units: { $sum: '$unitsConsumed' }, amount: { $sum: '$totalAmount' }, bills: { $sum: 1 } } },
    { $sort: { units: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'consumer' } },
    { $unwind: '$consumer' },
    { $project: { units: 1, amount: 1, bills: 1, name: '$consumer.name', consumerId: '$consumer.consumerId' } }
  ]);

  const monthly = await Bill.aggregate([
    { $group: { _id: '$billingMonth', units: { $sum: '$unitsConsumed' }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$totalAmount', 0] } } } },
    { $sort: { _id: 1 } },
    { $limit: 12 }
  ]);

  const totalConsumers = await User.countDocuments({ role: 'consumer' });
  const totalReaders = await User.countDocuments({ role: 'meterReader' });
  const totalMeters = await Meter.countDocuments();
  const activeMeters = await Meter.countDocuments({ status: 'Active' });
  const activeTariffs = await Tariff.countDocuments({ isActive: true });
  const totalReadings = await Reading.countDocuments();

  const byStatus = (status) => statusCounts.find(s => s._id === status) || { count: 0, amount: 0 };

  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    stats: {
      totalBills: totals[0]?.totalBills || 0,
      totalUnits: totals[0]?.totalUnits || 0,
      totalBilled: totals[0]?.totalBilled || 0,
      paid: byStatus('Paid'),
      unpaid: byStatus('Unpaid'),
      overdue: byStatus('Overdue'),
      totalConsumers, totalReaders, totalMeters, activeMeters, activeTariffs, totalReadings
    },
    topConsumers,
    monthly
  });
});

// ---------- consumers ----------

async function nextConsumerId() {
  const count = await User.countDocuments({ role: 'consumer' });
  let n = 1001 + count;
  while (await User.exists({ consumerId: `CON-${n}` })) n++;
  return `CON-${n}`;
}

exports.listConsumers = catchAsync(async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = { role: 'consumer' };
  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [{ name: regex }, { email: regex }, { consumerId: regex }];
  }

  const consumers = await User.find(filter).sort({ createdAt: -1 });

  const meterCounts = await Meter.aggregate([{ $group: { _id: '$consumer', count: { $sum: 1 } } }]);
  const meterMap = {};
  meterCounts.forEach(m => { meterMap[m._id] = m.count; });

  res.render('admin/consumers', { title: 'Consumers', consumers, meterMap, q });
});

exports.newConsumerForm = (req, res) => {
  res.render('admin/consumerForm', { title: 'Add Consumer', consumer: null, form: {} });
};

exports.createConsumer = catchAsync(async (req, res) => {
  const { name, email, password, address, connectionType } = req.body;

  const existing = await User.findOne({ email: (email || '').toLowerCase().trim() });
  if (existing) {
    req.flash('error', 'That email is already registered.');
    return res.status(400).render('admin/consumerForm', { title: 'Add Consumer', consumer: null, form: req.body });
  }

  const consumer = await User.create({
    name, email, password: password || 'Consumer@123',
    role: 'consumer', consumerId: await nextConsumerId(), address, connectionType
  });

  req.flash('success', `Consumer ${consumer.name} created (${consumer.consumerId}).`);
  res.redirect('/admin/consumers');
});

exports.editConsumerForm = catchAsync(async (req, res, next) => {
  const consumer = await User.findOne({ _id: req.params.id, role: 'consumer' });
  if (!consumer) return next(new AppError('Consumer not found', 404));
  res.render('admin/consumerForm', { title: 'Edit Consumer', consumer, form: consumer });
});

exports.updateConsumer = catchAsync(async (req, res, next) => {
  const { name, email, address, connectionType, isActive } = req.body;

  const consumer = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'consumer' },
    { name, email, address, connectionType, isActive: isActive === 'on' },
    { new: true, runValidators: true }
  );
  if (!consumer) return next(new AppError('Consumer not found', 404));

  req.flash('success', 'Consumer updated.');
  res.redirect('/admin/consumers');
});

// ---------- meters ----------

exports.listMeters = catchAsync(async (req, res) => {
  const meters = await Meter.find().populate('consumer', 'name consumerId email').sort({ createdAt: -1 });
  res.render('admin/meters', { title: 'Meters', meters });
});

exports.newMeterForm = catchAsync(async (req, res) => {
  const consumers = await User.find({ role: 'consumer', isActive: true }).sort('name');
  res.render('admin/meterForm', { title: 'Add Meter', consumers, form: {} });
});

exports.createMeter = catchAsync(async (req, res) => {
  const { meterNumber, consumer: consumerId, installationDate } = req.body;

  const consumer = await User.findOne({ _id: consumerId, role: 'consumer' });
  if (!consumer) {
    req.flash('error', 'Select a valid consumer.');
    return res.redirect('/admin/meters/new');
  }

  const existingMeter = await Meter.findOne({ meterNumber: (meterNumber || '').toUpperCase().trim() });
  if (existingMeter) {
    req.flash('error', 'That meter number already exists.');
    return res.redirect('/admin/meters/new');
  }

  await Meter.create({
    meterNumber,
    consumer: consumer._id,
    connectionType: consumer.connectionType || 'Domestic',
    installationDate: installationDate || Date.now()
  });

  req.flash('success', 'Meter added.');
  res.redirect('/admin/meters');
});

exports.toggleMeter = catchAsync(async (req, res, next) => {
  const meter = await Meter.findById(req.params.id);
  if (!meter) return next(new AppError('Meter not found', 404));

  meter.status = meter.status === 'Active' ? 'Inactive' : 'Active';
  await meter.save();

  req.flash('success', `Meter ${meter.meterNumber} is now ${meter.status}.`);
  res.redirect('/admin/meters');
});

// ---------- tariffs ----------

exports.listTariffs = catchAsync(async (req, res) => {
  const tariffs = await Tariff.find().sort({ connectionType: 1, isActive: -1 });
  res.render('admin/tariffs', { title: 'Tariffs', tariffs });
});

exports.newTariffForm = (req, res) => {
  res.render('admin/tariffForm', { title: 'Add Tariff' });
};

// the form sends parallel arrays: from[], to[], rate[]
function parseSlabsFromForm(body) {
  const from = [].concat(body.from || []);
  const to = [].concat(body.to || []);
  const rate = [].concat(body.rate || []);

  return from
    .map((f, i) => ({
      from: Number(f),
      to: to[i] === '' || to[i] === undefined ? null : Number(to[i]),
      rate: Number(rate[i])
    }))
    .filter(slab => !isNaN(slab.from) && !isNaN(slab.rate));
}

exports.createTariff = catchAsync(async (req, res) => {
  const { name, connectionType, fixedCharge } = req.body;
  const slabs = parseSlabsFromForm(req.body);

  try {
    const tariff = await Tariff.create({ name, connectionType, fixedCharge: Number(fixedCharge), slabs, isActive: true });
    // only one active tariff per connection type
    await Tariff.updateMany({ connectionType, _id: { $ne: tariff._id } }, { isActive: false });
    req.flash('success', `Tariff "${tariff.name}" created and set active.`);
  } catch (err) {
    req.flash('error', err.message);
  }

  res.redirect('/admin/tariffs');
});

exports.activateTariff = catchAsync(async (req, res, next) => {
  const tariff = await Tariff.findById(req.params.id);
  if (!tariff) return next(new AppError('Tariff not found', 404));

  await Tariff.updateMany({ connectionType: tariff.connectionType }, { isActive: false });
  tariff.isActive = true;
  await tariff.save();

  req.flash('success', `"${tariff.name}" is now the active ${tariff.connectionType} tariff.`);
  res.redirect('/admin/tariffs');
});

// ---------- meter readers ----------

exports.listReaders = catchAsync(async (req, res) => {
  const readers = await User.find({ role: 'meterReader' }).sort({ createdAt: -1 });

  const counts = await Reading.aggregate([{ $group: { _id: '$enteredBy', count: { $sum: 1 } } }]);
  const readingMap = {};
  counts.forEach(c => { readingMap[c._id] = c.count; });

  res.render('admin/readers', { title: 'Meter Readers', readers, readingMap });
});

exports.newReaderForm = (req, res) => {
  res.render('admin/readerForm', { title: 'Add Meter Reader', form: {} });
};

exports.createReader = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: (email || '').toLowerCase().trim() });
  if (existing) {
    req.flash('error', 'That email is already registered.');
    return res.redirect('/admin/readers/new');
  }

  await User.create({ name, email, password: password || 'Reader@123', role: 'meterReader' });
  req.flash('success', 'Meter reader created.');
  res.redirect('/admin/readers');
});

// ---------- bills ----------

exports.listBills = catchAsync(async (req, res) => {
  await refreshBillStatuses();

  const { status, month, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (month) filter.billingMonth = month;

  let bills = await Bill.find(filter)
    .populate('consumer', 'name consumerId')
    .populate('meter', 'meterNumber')
    .sort({ billingMonth: -1, createdAt: -1 })
    .limit(300);

  if (q) {
    const regex = new RegExp(q.trim(), 'i');
    bills = bills.filter(b => regex.test(b.billNumber) || regex.test(b.consumer?.name || '') || regex.test(b.consumer?.consumerId || ''));
  }

  const months = await Bill.distinct('billingMonth');

  res.render('admin/bills', { title: 'All Bills', bills, months: months.sort().reverse(), filters: { status, month, q } });
});
