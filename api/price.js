const nacl = require('tweetnacl');
const store = require('./_store');

async function signMessage(message, privateKeyInput) {
  if (!privateKeyInput) {
    throw new Error('SUI_PRIVATE_KEY environment variable is not set');
  }

  const { decodeSuiPrivateKey } = await import('@mysten/sui/cryptography');
  const decoded = decodeSuiPrivateKey(privateKeyInput);
  
  // Ensure we slice down to the exact 32 bytes required by nacl seed
  let secretKeyBytes = decoded.secretKey;
  if (secretKeyBytes.length > 32) {
    secretKeyBytes = secretKeyBytes.slice(0, 32);
  }

  const keyPair = nacl.sign.keyPair.fromSeed(secretKeyBytes);

  const messageBytes = Buffer.from(message, 'utf8');
  const signatureBytes = nacl.sign.detached(messageBytes, keyPair.secretKey);
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

    const sig = await signMessage(messageToSign, process.env.SUI_PRIVATE_KEY || '');

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