// Quick manual tests for the billing calculator.
// Run: npm run test:billing
const { calculateBill } = require('./billCalculator');

const tariff = {
  fixedCharge: 50,
  slabs: [
    { from: 0,   to: 100,  rate: 3 },
    { from: 100, to: 200,  rate: 5 },
    { from: 200, to: 500,  rate: 7 },
    { from: 500, to: null, rate: 10 }
  ]
};

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`PASS  ${label}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}  (got ${actual}, expected ${expected})`);
    failed++;
  }
}

function checkThrows(label, fn) {
  try {
    fn();
    console.log(`FAIL  ${label} (did not throw)`);
    failed++;
  } catch (err) {
    console.log(`PASS  ${label}`);
    passed++;
  }
}

console.log('--- billing calculator tests ---');

check('0 units -> no energy charge', calculateBill(0, tariff).energyCharge, 0);
check('0 units -> total is just fixed charge', calculateBill(0, tariff).totalAmount, 50);
check('50 units in first slab', calculateBill(50, tariff).energyCharge, 150);
check('exactly 100 units (slab boundary)', calculateBill(100, tariff).energyCharge, 300);
check('101 units crosses into slab 2', calculateBill(101, tariff).energyCharge, 305);
check('150 units across 2 slabs', calculateBill(150, tariff).energyCharge, 550);
check('150 units total amount', calculateBill(150, tariff).totalAmount, 600);
check('200 units', calculateBill(200, tariff).energyCharge, 800);
check('350 units across 3 slabs', calculateBill(350, tariff).energyCharge, 1850);
check('600 units across all slabs', calculateBill(600, tariff).energyCharge, 3900);
check('150 units uses 2 slabs', calculateBill(150, tariff).breakdown.length, 2);

checkThrows('negative units should throw', () => calculateBill(-10, tariff));
checkThrows('tariff with no slabs should throw', () => calculateBill(100, { fixedCharge: 0, slabs: [] }));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
