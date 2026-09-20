const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role:     { type: String, enum: ['admin', 'meterReader', 'consumer'], default: 'consumer' },

  // only used for consumers
  consumerId:     { type: String, unique: true, sparse: true, trim: true },
  address:        { type: String, trim: true },
  connectionType: { type: String, enum: ['Domestic', 'Commercial'] },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// hash the password whenever it changes, so it's never stored in plain text
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
