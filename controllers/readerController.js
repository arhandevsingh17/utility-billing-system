const Meter = require('../models/Meter');
const Reading = require('../models/Reading');
const { catchAsync } = require('../middleware/errorHandler');
const { generateBillForReading } = require('../utils/billingService');
const { currentBillingMonth } = require('../utils/helpers');

// the last reading recorded for a meter is the starting point for the next one
async function getLastReading(meterId) {
  return Reading.findOne({ meter: meterId }).sort({ billingMonth: -1, createdAt: -1 });
}

exports.dashboard = catchAsync(async (req, res) => {
  const month = currentBillingMonth();

  const activeMeters = await Meter.countDocuments({ status: 'Active' });
  const readingsThisMonth = await Reading.countDocuments({ billingMonth: month });
  const myReadings = await Reading.countDocuments({ enteredBy: req.user._id });
  const recent = await Reading.find({ enteredBy: req.user._id })
    .populate('meter', 'meterNumber')
    .populate('consumer', 'name consumerId')
    .sort({ createdAt: -1 })
    .limit(5);

  res.render('reader/dashboard', {
    title: 'Reader Dashboard',
    stats: { activeMeters, readingsThisMonth, myReadings, pending: Math.max(activeMeters - readingsThisMonth, 0), month },
    recent
  });
});

exports.listReadings = catchAsync(async (req, res) => {
  const filter = req.query.mine === '1' ? { enteredBy: req.user._id } : {};
  if (req.query.month) filter.billingMonth = req.query.month;

  const readings = await Reading.find(filter)
    .populate('meter', 'meterNumber connectionType')
    .populate('consumer', 'name consumerId')
    .populate('enteredBy', 'name')
    .sort({ createdAt: -1 })
    .limit(200);

  const months = (await Reading.distinct('billingMonth')).sort().reverse();

  res.render('reader/readings', { title: 'Readings', readings, months, filters: req.query });
});

exports.newReadingForm = catchAsync(async (req, res) => {
  const meters = await Meter.find({ status: 'Active' }).populate('consumer', 'name consumerId').sort('meterNumber');

  // find each meter's most recent reading so the form can show it right away
  const lastReadings = await Reading.aggregate([
    { $sort: { billingMonth: -1 } },
    { $group: { _id: '$meter', currentReading: { $first: '$currentReading' }, billingMonth: { $first: '$billingMonth' } } }
  ]);
  const lastMap = {};
  lastReadings.forEach(r => { lastMap[r._id] = r; });

  res.render('reader/readingForm', {
    title: 'New Reading',
    meters, lastMap,
    defaultMonth: currentBillingMonth(),
    selectedMeter: req.query.meter || ''
  });
});

// small JSON endpoint the form calls to fill in "previous reading" for the selected meter
exports.previousReadingJson = catchAsync(async (req, res) => {
  const meter = await Meter.findById(req.params.id);
  if (!meter) return res.status(404).json({ error: 'Meter not found' });

  const last = await getLastReading(meter._id);
  res.json({
    meterNumber: meter.meterNumber,
    previousReading: last ? last.currentReading : 0,
    lastMonth: last ? last.billingMonth : null
  });
});

exports.createReading = catchAsync(async (req, res, next) => {
  const { meter: meterId, currentReading, billingMonth, readingDate } = req.body;
  const back = '/reader/readings/new';

  const reject = (msg) => {
    req.flash('error', msg);
    return res.redirect(back);
  };

  const meter = await Meter.findById(meterId).populate('consumer');
  if (!meter) return reject('Please select a valid meter.');
  if (meter.status !== 'Active') return reject(`Meter ${meter.meterNumber} is inactive - readings cannot be recorded.`);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth || '')) {
    return reject('Billing month must be in YYYY-MM format.');
  }

  const current = Number(currentReading);
  if (isNaN(current) || current < 0) return reject('Current reading must be a non-negative number.');

  // previous reading always comes from the database, never trust the form
  const last = await getLastReading(meter._id);
  const previous = last ? last.currentReading : 0;

  if (current < previous) {
    return reject(`Rejected: current reading (${current}) is lower than the previous reading (${previous}) for meter ${meter.meterNumber}.`);
  }

  const alreadyExists = await Reading.exists({ meter: meter._id, billingMonth });
  if (alreadyExists) {
    return reject(`Rejected: a reading for meter ${meter.meterNumber} already exists for ${billingMonth}.`);
  }

  const reading = new Reading({
    meter: meter._id,
    consumer: meter.consumer._id,
    previousReading: previous,
    currentReading: current,
    unitsConsumed: current - previous,
    billingMonth,
    enteredBy: req.user._id,
    readingDate: readingDate ? new Date(readingDate) : new Date()
  });

  try {
    await reading.save();
  } catch (err) {
    if (err.code === 11000) return reject(`Rejected: duplicate reading for ${meter.meterNumber} in ${billingMonth}.`);
    return next(err);
  }

  let bill;
  try {
    bill = await generateBillForReading(reading, meter);
  } catch (err) {
    // if billing fails, don't leave a reading without a bill sitting around
    await Reading.deleteOne({ _id: reading._id });
    return reject(`Reading saved but billing failed, so it was rolled back: ${err.message}`);
  }

  req.flash('success', `Reading recorded for ${meter.meterNumber}: ${reading.unitsConsumed} kWh consumed. Bill ${bill.billNumber} generated.`);
  res.redirect('/reader/readings');
});
