const Meter = require('../models/Meter');
const Reading = require('../models/Reading');
const Bill = require('../models/Bill');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { refreshBillStatuses, formatMonth } = require('../utils/helpers');

exports.dashboard = catchAsync(async (req, res) => {
  await refreshBillStatuses({ consumer: req.user._id });

  const latest = await Bill.findOne({ consumer: req.user._id }).populate('meter', 'meterNumber').sort({ billingMonth: -1 });
  const meters = await Meter.find({ consumer: req.user._id });
  const recent = await Bill.find({ consumer: req.user._id }).sort({ billingMonth: -1 }).limit(6);

  const summary = await Bill.aggregate([
    { $match: { consumer: req.user._id } },
    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }
  ]);
  const byStatus = (status) => summary.find(s => s._id === status) || { count: 0, amount: 0 };

  const totalUnits = recent.reduce((sum, bill) => sum + (bill.unitsConsumed || 0), 0);

  res.render('consumer/dashboard', {
    title: 'My Dashboard',
    latest, meters,
    stats: { paid: byStatus('Paid'), unpaid: byStatus('Unpaid'), overdue: byStatus('Overdue'), totalUnits },
    recent
  });
});

exports.currentBill = catchAsync(async (req, res) => {
  await refreshBillStatuses({ consumer: req.user._id });

  const bill = await Bill.findOne({ consumer: req.user._id })
    .populate('meter', 'meterNumber connectionType')
    .populate('consumer', 'name consumerId address connectionType email')
    .sort({ billingMonth: -1 });

  res.render('consumer/bill', { title: 'Current Bill', bill });
});

exports.listBills = catchAsync(async (req, res) => {
  await refreshBillStatuses({ consumer: req.user._id });

  const filter = { consumer: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const bills = await Bill.find(filter).populate('meter', 'meterNumber').sort({ billingMonth: -1 });

  res.render('consumer/bills', { title: 'My Bills', bills, filters: req.query });
});

exports.billDetail = catchAsync(async (req, res, next) => {
  await refreshBillStatuses({ consumer: req.user._id });

  // scoping the query to the logged-in consumer is what stops someone
  // from viewing another consumer's bill just by changing the id in the url
  const bill = await Bill.findOne({ _id: req.params.id, consumer: req.user._id })
    .populate('meter', 'meterNumber connectionType')
    .populate('consumer', 'name consumerId address connectionType email');

  if (!bill) return next(new AppError('Bill not found or you do not have access to it', 404));

  res.render('consumer/bill', { title: `Bill ${bill.billNumber}`, bill });
});

exports.payBill = catchAsync(async (req, res, next) => {
  const bill = await Bill.findOne({ _id: req.params.id, consumer: req.user._id });
  if (!bill) return next(new AppError('Bill not found or you do not have access to it', 404));

  if (bill.status === 'Paid') {
    req.flash('error', `Bill ${bill.billNumber} is already paid (${new Date(bill.paidAt).toLocaleString('en-IN')}).`);
    return res.redirect(`/consumer/bills/${bill._id}`);
  }

  bill.status = 'Paid';
  bill.paidAt = new Date();
  await bill.save();

  req.flash('success', `Payment recorded for ${bill.billNumber}. (Simulated academic payment - no real gateway.)`);
  res.redirect(`/consumer/bills/${bill._id}`);
});

exports.consumption = catchAsync(async (req, res) => {
  const readings = await Reading.find({ consumer: req.user._id })
    .populate('meter', 'meterNumber')
    .sort({ billingMonth: 1 })
    .limit(24);

  const bills = await Bill.find({ consumer: req.user._id }).sort({ billingMonth: 1 }).limit(24);
  const billMap = {};
  bills.forEach(b => { billMap[b.billingMonth] = b; });

  const chart = {
    labels: readings.map(r => formatMonth(r.billingMonth)),
    units: readings.map(r => r.unitsConsumed),
    amounts: readings.map(r => billMap[r.billingMonth]?.totalAmount || 0)
  };

  const units = chart.units;
  const summary = {
    total: units.reduce((a, b) => a + b, 0),
    average: units.length ? Math.round(units.reduce((a, b) => a + b, 0) / units.length) : 0,
    highest: units.length ? Math.max(...units) : 0,
    lowest: units.length ? Math.min(...units) : 0
  };

  res.render('consumer/consumption', { title: 'Consumption History', readings, chart, summary, billMap });
});
