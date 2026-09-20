const mongoose = require('mongoose');

// A slab like { from: 0, to: 100, rate: 3 } covers units 0-100.
// to: null means "no upper limit" (used for the last slab).
const slabSchema = new mongoose.Schema({
  from: { type: Number, required: true, min: 0 },
  to:   { type: Number, default: null },
  rate: { type: Number, required: true, min: 0 }
}, { _id: false });

const tariffSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  connectionType: { type: String, enum: ['Domestic', 'Commercial'], required: true },
  fixedCharge:    { type: Number, required: true, min: 0, default: 50 },
  slabs:          { type: [slabSchema], required: true },
  isActive:       { type: Boolean, default: true }
}, { timestamps: true });

tariffSchema.index({ connectionType: 1, isActive: 1 });

// make sure the slabs are in order and don't overlap or leave gaps
tariffSchema.pre('validate', function (next) {
  if (!this.slabs || this.slabs.length === 0) {
    return next(new Error('A tariff must have at least one slab'));
  }

  const sorted = [...this.slabs].sort((a, b) => a.from - b.from);
  for (let i = 0; i < sorted.length; i++) {
    const slab = sorted[i];
    if (slab.to != null && slab.to <= slab.from) {
      return next(new Error(`Slab starting at ${slab.from} has an invalid upper limit`));
    }
    if (i > 0) {
      const prevSlab = sorted[i - 1];
      if (prevSlab.to == null) {
        return next(new Error('Only the last slab can be unbounded'));
      }
      if (prevSlab.to !== slab.from) {
        return next(new Error(`Slabs must connect: ${prevSlab.to} does not match ${slab.from}`));
      }
    }
  }

  this.slabs = sorted;
  next();
});

module.exports = mongoose.model('Tariff', tariffSchema);
