// Fills the database with some demo data so the app isn't empty on first run.
// Run: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const User = require('./models/User');
const Meter = require('./models/Meter');
const Tariff = require('./models/Tariff');
const Reading = require('./models/Reading');
const Bill = require('./models/Bill');
const { generateBillForReading } = require('./utils/billingService');

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateForMonth(ym, day = 5) {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, day);
}

async function seed() {
  await connectDB();

  console.log('Clearing existing data...');
  await User.deleteMany({});
  await Meter.deleteMany({});
  await Tariff.deleteMany({});
  await Reading.deleteMany({});
  await Bill.deleteMany({});

  await Tariff.create({
    name: 'Domestic Demo Tariff 2025', connectionType: 'Domestic', fixedCharge: 50, isActive: true,
    slabs: [
      { from: 0, to: 100, rate: 3 },
      { from: 100, to: 200, rate: 5 },
      { from: 200, to: 500, rate: 7 },
      { from: 500, to: null, rate: 10 }
    ]
  });

  await Tariff.create({
    name: 'Commercial Demo Tariff 2025', connectionType: 'Commercial', fixedCharge: 150, isActive: true,
    slabs: [
      { from: 0, to: 200, rate: 6 },
      { from: 200, to: 500, rate: 9 },
      { from: 500, to: null, rate: 12 }
    ]
  });
  console.log('Tariffs created.');

  await User.create({
    name: 'System Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@ubs.test',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
    role: 'admin'
  });

  const reader = await User.create({ name: 'Ravi Kumar (Meter Reader)', email: 'reader@ubs.test', password: 'Reader@123', role: 'meterReader' });
  await User.create({ name: 'Neha Sharma (Meter Reader)', email: 'reader2@ubs.test', password: 'Reader@123', role: 'meterReader' });

  const consumerSeed = [
    { name: 'Asha Verma',         email: 'asha@ubs.test',        connectionType: 'Domestic',   address: '12, Rose Lane, Delhi',       base: 1000, usage: [120, 145, 98, 210, 165] },
    { name: 'Imran Qureshi',      email: 'imran@ubs.test',       connectionType: 'Domestic',   address: '44, Park Street, Delhi',     base: 2400, usage: [85, 92, 101, 78, 96] },
    { name: 'Lakshmi Iyer',       email: 'lakshmi@ubs.test',     connectionType: 'Domestic',   address: '7, Green Park, Delhi',       base: 800,  usage: [310, 280, 355, 420, 390] },
    { name: 'Bright Mart Stores', email: 'brightmart@ubs.test',  connectionType: 'Commercial', address: 'Shop 3, Main Bazaar, Delhi', base: 5000, usage: [640, 720, 580, 810, 760] },
    { name: 'Kabir Nath',         email: 'kabir@ubs.test',       connectionType: 'Domestic',   address: '19, Hill View, Delhi',       base: 150,  usage: [0, 45, 60, 55, 70] }
  ];

  let consumerCounter = 1001;
  let meterCounter = 1001;
  let readingCount = 0;
  let billCount = 0;

  for (const c of consumerSeed) {
    const consumer = await User.create({
      name: c.name, email: c.email, password: 'Consumer@123', role: 'consumer',
      consumerId: `CON-${consumerCounter++}`, address: c.address, connectionType: c.connectionType
    });

    const meter = await Meter.create({
      meterNumber: `MTR-${meterCounter++}`,
      consumer: consumer._id,
      connectionType: c.connectionType,
      status: 'Active',
      installationDate: new Date(2022, 0, 15)
    });

    let runningReading = c.base;

    // go oldest month first so previousReading chains correctly
    for (let i = c.usage.length; i >= 1; i--) {
      const month = monthsAgo(i);
      const units = c.usage[c.usage.length - i];
      const previous = runningReading;
      runningReading += units;

      const reading = await Reading.create({
        meter: meter._id,
        consumer: consumer._id,
        previousReading: previous,
        currentReading: runningReading,
        unitsConsumed: units,
        billingMonth: month,
        enteredBy: reader._id,
        readingDate: dateForMonth(month)
      });
      readingCount++;

      const bill = await generateBillForReading(reading, meter);
      billCount++;

      // mark the older bills as paid so the dashboard shows a realistic mix
      if (i >= 3) {
        bill.status = 'Paid';
        bill.paidAt = dateForMonth(month, 20);
        await bill.save();
      }
    }
  }

  console.log(`\nSeed complete: ${consumerSeed.length} consumers, ${consumerSeed.length} meters, ${readingCount} readings, ${billCount} bills.`);
  console.log('\nDemo credentials:');
  console.log('Admin        admin@ubs.test      / Admin@123');
  console.log('Meter Reader reader@ubs.test     / Reader@123');
  console.log('Consumer     asha@ubs.test       / Consumer@123');
  console.log('Consumer     brightmart@ubs.test / Consumer@123 (commercial)\n');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
