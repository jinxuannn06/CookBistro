const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP_FILE = path.join(os.tmpdir(), 'cookbistro_price_override.json');

// Global in-memory variable:
// "Store this price override in a global in-memory variable so the GET request can read it during our live demo."
if (!globalThis.__COOKBISTRO_PRICE_STORE__) {
  globalThis.__COOKBISTRO_PRICE_STORE__ = {
    price_cents: null
  };
}

/**
 * Gets the current active price in cents.
 * Priority:
 * 1. Global in-memory variable if set
 * 2. /tmp file backup if set
 * 3. Default to 7500 (RM75.00)
 */
function getPrice() {
  // 1. In-memory override
  if (
    globalThis.__COOKBISTRO_PRICE_STORE__.price_cents !== null &&
    globalThis.__COOKBISTRO_PRICE_STORE__.price_cents !== undefined
  ) {
    return globalThis.__COOKBISTRO_PRICE_STORE__.price_cents;
  }

  // 2. Persistent fallback in /tmp across lambda restarts
  try {
    if (fs.existsSync(TMP_FILE)) {
      const data = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
      if (Number.isInteger(data.price_cents)) {
        globalThis.__COOKBISTRO_PRICE_STORE__.price_cents = data.price_cents;
        return data.price_cents;
      }
    }
  } catch (e) {}

  // 3. Default price: 7500 (RM75.00)
  return 7500;
}

/**
 * Stores the price override in cents.
 */
function setPrice(cents) {
  // Store in global in-memory variable
  globalThis.__COOKBISTRO_PRICE_STORE__.price_cents = cents;

  // Also write to /tmp for durability
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify({ price_cents: cents, updated_at: Date.now() }));
  } catch (e) {}
}

/**
 * Resets the price override back to default.
 */
function resetPrice() {
  globalThis.__COOKBISTRO_PRICE_STORE__.price_cents = null;
  try {
    if (fs.existsSync(TMP_FILE)) {
      fs.unlinkSync(TMP_FILE);
    }
  } catch (e) {}
}

module.exports = {
  getPrice,
  setPrice,
  resetPrice
};
