// Slab-wise electricity bill calculator.
// Takes units consumed + a tariff and works out the energy charge.
// Kept separate from everything else so it's easy to test on its own.

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function calculateBill(units, tariff) {
  if (typeof units !== 'number' || isNaN(units)) {
    throw new Error('Units consumed must be a number');
  }
  if (units < 0) {
    throw new Error('Units consumed cannot be negative');
  }
  if (!tariff || !tariff.slabs || tariff.slabs.length === 0) {
    throw new Error('No tariff slabs configured');
  }

  // slabs are stored like { from: 0, to: 100 }, { from: 100, to: 200 }, ...
  // to: null means the last (unbounded) slab
  const slabs = [...tariff.slabs].sort((a, b) => a.from - b.from);

  let remainingUnits = units;
  let energyCharge = 0;
  const breakdown = [];

  for (const slab of slabs) {
    if (remainingUnits <= 0) break;

    const slabTop = slab.to == null ? Infinity : slab.to;
    const slabSize = slabTop - slab.from;
    const unitsInSlab = Math.min(remainingUnits, slabSize);

    if (unitsInSlab <= 0) continue;

    const amount = round2(unitsInSlab * slab.rate);
    energyCharge += amount;
    remainingUnits -= unitsInSlab;

    breakdown.push({
      from: slab.from,
      to: slab.to == null ? null : slab.to,
      units: unitsInSlab,
      rate: slab.rate,
      amount
    });
  }

  // shouldn't happen if the tariff's last slab is unbounded, but just in case
  if (remainingUnits > 0) {
    throw new Error(`Tariff does not cover ${units} units - last slab must be unbounded`);
  }

  const fixedCharge = round2(tariff.fixedCharge || 0);
  energyCharge = round2(energyCharge);

  return {
    unitsConsumed: units,
    energyCharge,
    fixedCharge,
    totalAmount: round2(energyCharge + fixedCharge),
    breakdown
  };
}

module.exports = { calculateBill, round2 };
