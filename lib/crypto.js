const nacl = require('tweetnacl');

/**
 * Decodes a Bech32 string (e.g. suiprivkey1...)
 */
function decodeBech32(str) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const pos = str.lastIndexOf('1');
  if (pos < 1) return null;
  const hrp = str.slice(0, pos);
  const data = [];
  for (let i = pos + 1; i < str.length; i++) {
    const d = CHARSET.indexOf(str[i].toLowerCase());
    if (d === -1) return null;
    data.push(d);
  }
  if (data.length < 6) return null;
  const payload = data.slice(0, -6);
  let acc = 0;
  let bits = 0;
  const result = [];
  for (const value of payload) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      result.push((acc >> bits) & 0xff);
    }
  }
  return { hrp, bytes: Buffer.from(result) };
}

/**
 * Parses a private key in various formats:
 * - Bech32 (suiprivkey1...)
 * - Hex (32-byte seed or 64-byte secret key, with or without 0x)
 * - Base64 (32-byte seed, 33-byte flagged key, or 64-byte secret key)
 * - Fallback demo key if not set
 */
function parsePrivateKey(keyInput) {
  if (!keyInput || typeof keyInput !== 'string') {
    return {
      seed: Buffer.from('6c223b7b059033349abc75f501970e0d2b76f58a15d7de8894fa573509bbec17', 'hex'),
      isDemo: true
    };
  }

  const trimmed = keyInput.trim();

  // 1. Bech32 format (suiprivkey1...)
  if (trimmed.startsWith('suiprivkey1')) {
    const decoded = decodeBech32(trimmed);
    if (decoded && decoded.bytes.length === 33) {
      // 1-byte scheme (0x00 = ed25519) + 32-byte seed
      return { seed: decoded.bytes.slice(1), isDemo: false };
    }
  }

  // 2. Hex string
  const cleanHex = trimmed.replace(/^0x/i, '');
  if (/^[0-9a-fA-F]+$/.test(cleanHex)) {
    if (cleanHex.length === 64) {
      return { seed: Buffer.from(cleanHex, 'hex'), isDemo: false };
    }
    if (cleanHex.length === 128) {
      return { secretKey: Buffer.from(cleanHex, 'hex'), isDemo: false };
    }
  }

  // 3. Base64 string
  try {
    const b64 = Buffer.from(trimmed, 'base64');
    if (b64.length === 32) {
      return { seed: b64, isDemo: false };
    }
    if (b64.length === 33 && b64[0] === 0) {
      return { seed: b64.slice(1), isDemo: false };
    }
    if (b64.length === 64) {
      return { secretKey: b64, isDemo: false };
    }
  } catch (e) {}

  // Fallback demo key
  return {
    seed: Buffer.from('6c223b7b059033349abc75f501970e0d2b76f58a15d7de8894fa573509bbec17', 'hex'),
    isDemo: true
  };
}

/**
 * Retrieves supplier address from process.env.SUI_SUPPLIER_ADDRESS
 * Returns { full: '0x...', clean: '...' }
 */
function getSupplierAddress() {
  const raw = (process.env.SUI_SUPPLIER_ADDRESS || '').trim();
  const fallback = '6c223b7b059033349abc75f501970e0d2b76f58a15d7de8894fa573509bbec17';
  const clean = raw ? raw.replace(/^0x/i, '').toLowerCase() : fallback;
  return {
    full: `0x${clean}`,
    clean: clean
  };
}

/**
 * Generates an Ed25519 signature matching the exact byte format:
 * message = "<item>|<price_cents>|<ts>|<supplier_address_lowercase_no_0x_prefix>"
 * e.g. "coffee|950|1788500000|6c223b7b059033349abc75f501970e0d2b76f58a15d7de8894fa573509bbec17"
 * UTF-8 encoded, raw 64-byte signature -> 128 hex chars.
 */
function signPricingData({ item, price_cents, ts, cleanSupplierAddress }) {
  const privateKeyStr = process.env.SUI_PRIVATE_KEY;
  const keyInfo = parsePrivateKey(privateKeyStr);

  let keyPair;
  if (keyInfo.seed) {
    keyPair = nacl.sign.keyPair.fromSeed(keyInfo.seed);
  } else {
    keyPair = nacl.sign.keyPair.fromSecretKey(keyInfo.secretKey);
  }

  // Exact message format: <item>|<price_cents>|<ts>|<supplier_address_lowercase_no_0x_prefix>
  const messageStr = `${item}|${price_cents}|${ts}|${cleanSupplierAddress}`;
  const messageBytes = Buffer.from(messageStr, 'utf8');

  // Detached Ed25519 signature
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);
  const sigHex = Buffer.from(signature).toString('hex');

  return {
    message: messageStr,
    sig: sigHex,
    publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
    isDemoKey: keyInfo.isDemo
  };
}

module.exports = {
  getSupplierAddress,
  signPricingData,
  parsePrivateKey
};
