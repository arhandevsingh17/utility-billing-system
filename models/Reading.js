const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  meter:           { type: mongoose.Schema.Types.ObjectId, ref: 'Meter', required: true },
  consumer:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  previousReading: { type: Number, required: true, min: 0 },
  currentReading:  { type: Number, required: true, min: 0 },
  unitsConsumed:   { type: Number, required: true, min: 0 },
  billingMonth:    { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  enteredBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readingDate:     { type: Date, default: Date.now }
}, { timestamps: true });

// stops the same meter from getting two readings in the same month
readingSchema.index({ meter: 1, billingMonth: 1 }, { unique: true });
readingSchema.index({ consumer: 1, billingMonth: -1 });

module.exports = mongoose.model('Reading', readingSchema);
