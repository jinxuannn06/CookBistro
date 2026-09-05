const { setPrice, getPrice } = require('../lib/store');

module.exports = async function handler(req, res) {
  // CORS Headers for cross-origin frontend requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET helper to quickly view current price
  if (req.method === 'GET') {
    return res.status(200).json({
      price_cents: getPrice()
    });
  }

  // Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Malformed JSON payload in request body' });
      }
    }

    if (!body || body.price_cents === undefined || body.price_cents === null) {
      return res.status(400).json({
        error: 'Missing required field: price_cents (e.g. {"price_cents": 950})'
      });
    }

    const price_cents = Number(body.price_cents);
    if (!Number.isInteger(price_cents) || price_cents < 0) {
      return res.status(400).json({
        error: 'price_cents must be a non-negative integer (e.g. 950 for RM9.50, 7500 for RM75.00). No floats.'
      });
    }

    // Store in global in-memory variable (and backup store)
    setPrice(price_cents);

    return res.status(200).json({
      success: true,
      price_cents: price_cents,
      message: `Price override stored. GET /api/price will now return ${price_cents}.`
    });
  } catch (error) {
    console.error('Error handling /api/set-price:', error);
    return res.status(500).json({
      error: 'Internal server error setting price override',
      message: error.message
    });
  }
};
