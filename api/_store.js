let currentPriceCents = null;

module.exports = {
  getPriceCents: () => (currentPriceCents !== null ? currentPriceCents : 7500),
  setPriceCents: (val) => {
    currentPriceCents = parseInt(val, 10);
  },
};
