const store = require('./_store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { price_cents } = req.body || {};

    if (price_cents === undefined || isNaN(price_cents)) {
      return res.status(400).json({ error: 'Missing or invalid price_cents' });
    }

    const parsedPrice = parseInt(price_cents, 10);
    store.setPriceCents(parsedPrice);

    return res.status(200).json({
      success: true,
      price_cents: parsedPrice,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
