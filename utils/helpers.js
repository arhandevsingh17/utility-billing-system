const Bill = require('../models/Bill');

const SURCHARGE_RATE = Number(process.env.SURCHARGE_RATE || 0.02); // 2% late fee
const DUE_DAYS = Number(process.env.DUE_DAYS || 15);

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// e.g. "2025-03"
function currentBillingMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// "2025-03" -> "March 2025"
function formatMonth(ym) {
  if (!ym) return '-';
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function formatCurrency(amount) {
  return '\u20B9' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date) {
  return date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

// slabs are stored as 0-100, 100-200 ... but shown to users as 0-100, 101-200
function formatSlabRange(from, to) {
  const lower = from === 0 ? 0 : from + 1;
  return to == null ? `${lower}+ units` : `${lower} - ${to} units`;
}

function dueDateFrom(date = new Date()) {
  const due = new Date(date);
  due.setDate(due.getDate() + DUE_DAYS);
  return due;
}

function homePathForRole(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'meterReader') return '/reader/dashboard';
  return '/consumer/dashboard';
}

// Marks unpaid bills past their due date as Overdue and adds the late fee.
// Runs whenever bills are fetched instead of needing a cron job.
async function refreshBillStatuses(filter = {}) {
  const now = new Date();
  const overdueBills = await Bill.find({ ...filter, status: { $ne: 'Paid' }, dueDate: { $lt: now } });
  if (overdueBills.length === 0) return;

  for (const bill of overdueBills) {
    const update = { status: 'Overdue' };
    if (!bill.surcharge) {
      const surcharge = round2((bill.energyCharge + bill.fixedCharge) * SURCHARGE_RATE);
      update.surcharge = surcharge;
      update.totalAmount = round2(bill.energyCharge + bill.fixedCharge + surcharge);
    }
    await Bill.updateOne({ _id: bill._id }, { $set: update });
  }
}

module.exports = {
  SURCHARGE_RATE, DUE_DAYS, round2,
  currentBillingMonth, formatMonth, formatCurrency, formatDate, formatSlabRange,
  dueDateFrom, homePathForRole, refreshBillStatuses
};
