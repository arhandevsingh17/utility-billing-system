const mongoose = require('mongoose');

const slabBreakdownSchema = new mongoose.Schema({
  from: Number, to: Number, units: Number, rate: Number, amount: Number
}, { _id: false });

const billSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },
  consumer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  meter:      { type: mongoose.Schema.Types.ObjectId, ref: 'Meter',   required: true },
  reading:    { type: mongoose.Schema.Types.ObjectId, ref: 'Reading', required: true },

  billingMonth: { type: String, required: true },

  // these are copied from the reading/tariff at the time the bill was made,
  // so if the tariff changes later, old bills don't change with it
  previousReading: Number,
  currentReading:  Number,
  unitsConsumed:   Number,
  energyCharge:    Number,
  fixedCharge:     Number,
  surcharge:       { type: Number, default: 0 },
  totalAmount:     Number,
  slabBreakdown:   [slabBreakdownSchema],
  tariffName:      String,

  dueDate: { type: Date, required: true },
  status:  { type: String, enum: ['Unpaid', 'Paid', 'Overdue'], default: 'Unpaid' },
  paidAt:  { type: Date, default: null }
}, { timestamps: true });

billSchema.index({ meter: 1, billingMonth: 1 }, { unique: true });
billSchema.index({ consumer: 1, billingMonth: -1 });
billSchema.index({ status: 1 });

module.exports = mongoose.model('Bill', billSchema);
