const { getPrice } = require('../lib/store');
const { getSupplierAddress, signPricingData } = require('../lib/crypto');

module.exports = async function handler(req, res) {
  // CORS Headers for cross-origin frontend requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Method check
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  try {
    // 1. item: from query param (?item=xxx), default to "coffee"
    const item = (req.query && req.query.item) ? String(req.query.item).trim() : 'coffee';

    // 2. price_cents: integer (default 7500 if unset via POST /api/set-price)
    const price_cents = getPrice();

    // 3. unit: 'kg'
    const unit = 'kg';

    // 4. ts: current unix timestamp in seconds (fresh on every request)
    const ts = Math.floor(Date.now() / 1000);

    // 5. supplier_address: formatted with 0x prefix and 64 lowercase hex chars
    const { full: supplier_address, clean: cleanSupplierAddress } = getSupplierAddress();

    // 6. sig: Ed25519 signature of "<item>|<price_cents>|<ts>|<supplier_address_lowercase_no_0x_prefix>"
    const { sig } = signPricingData({
      item,
      price_cents,
      ts,
      cleanSupplierAddress
    });

    // Return exact specified JSON format
    return res.status(200).json({
      item,
      price_cents,
      unit,
      ts,
      supplier_address,
      sig
    });
  } catch (error) {
    console.error('Error handling /api/price:', error);
    return res.status(500).json({
      error: 'Internal server error processing pricing data',
      message: error.message
    });
  }
};
