const Bill = require('../models/Bill');
const Tariff = require('../models/Tariff');
const { calculateBill } = require('./billCalculator');
const { dueDateFrom } = require('./helpers');

// Generates a bill number like BILL-202503-0007
async function generateBillNumber(billingMonth) {
  const prefix = `BILL-${billingMonth.replace('-', '')}`;
  const count = await Bill.countDocuments({ billingMonth });
  let seq = count + 1;

  // just in case two bills for the same month get created around the same time
  while (await Bill.exists({ billNumber: `${prefix}-${String(seq).padStart(4, '0')}` })) {
    seq++;
  }
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// Looks up the active tariff for this meter's connection type, runs the
// billing calculation, and saves the bill.
async function generateBillForReading(reading, meter) {
  const tariff = await Tariff.findOne({ connectionType: meter.connectionType, isActive: true });
  if (!tariff) {
    throw new Error(`No active tariff configured for ${meter.connectionType} connections`);
  }

  const result = calculateBill(reading.unitsConsumed, tariff);

  const bill = await Bill.create({
    billNumber: await generateBillNumber(reading.billingMonth),
    consumer: reading.consumer,
    meter: meter._id,
    reading: reading._id,
    billingMonth: reading.billingMonth,
    previousReading: reading.previousReading,
    currentReading: reading.currentReading,
    unitsConsumed: reading.unitsConsumed,
    energyCharge: result.energyCharge,
    fixedCharge: result.fixedCharge,
    totalAmount: result.totalAmount,
    slabBreakdown: result.breakdown,
    tariffName: tariff.name,
    dueDate: dueDateFrom(reading.readingDate),
    status: 'Unpaid'
  });

  return bill;
}

module.exports = { generateBillForReading, generateBillNumber };
