const nacl = require('tweetnacl');
const store = require('./_store');
const { decodeSuiPrivateKey } = require('@mysten/sui/cryptography');

function signMessage(message, privateKeyInput) {
  if (!privateKeyInput) {
    throw new Error('SUI_PRIVATE_KEY environment variable is not set');
  }

  // Safely decode suiprivkey1 string into the 32-byte secret key required by tweetnacl
  const { secretKey } = decodeSuiPrivateKey(privateKeyInput);

  const messageBytes = Buffer.from(message, 'utf8');
  const signatureBytes = nacl.sign.detached(messageBytes, secretKey);
  return Buffer.from(signatureBytes).toString('hex');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const item = (req.query.item || 'coffee').toString();
    const priceCents = store.getPriceCents();
    const ts = Math.floor(Date.now() / 1000);
    const supplierAddress = process.env.SUI_SUPPLIER_ADDRESS || '';

    const cleanSupplierAddress = supplierAddress.toLowerCase().replace(/^0x/, '');
    const messageToSign = `${item}|${priceCents}|${ts}|${cleanSupplierAddress}`;

    const sig = signMessage(messageToSign, process.env.SUI_PRIVATE_KEY || '');

    return res.status(200).json({
      item,
      price_cents: priceCents,
      unit: 'kg',
      ts,
      supplier_address: supplierAddress,
      sig
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};