const mongoose = require('mongoose');

const meterSchema = new mongoose.Schema({
  meterNumber:      { type: String, required: true, unique: true, trim: true, uppercase: true },
  consumer:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  connectionType:   { type: String, enum: ['Domestic', 'Commercial'], required: true },
  status:           { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  installationDate: { type: Date, default: Date.now }
}, { timestamps: true });

meterSchema.index({ consumer: 1 });

module.exports = mongoose.model('Meter', meterSchema);
