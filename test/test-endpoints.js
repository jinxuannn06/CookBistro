const assert = require('assert');
const nacl = require('tweetnacl');
const priceHandler = require('../api/price');
const setPriceHandler = require('../api/set-price');
const { resetPrice, getPrice } = require('../lib/store');
const { parsePrivateKey } = require('../lib/crypto');

// Helper to mock Vercel Serverless req and res objects
function mockReqRes(options = {}) {
  const req = {
    method: options.method || 'GET',
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {}
  };

  let statusCode = 200;
  let headers = {};
  let responseData = null;

  const res = {
    setHeader(key, val) {
      headers[key] = val;
    },
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    end() {
      return res;
    },
    _getStatusCode: () => statusCode,
    _getData: () => responseData,
    _getHeaders: () => headers
  };

  return { req, res };
}

async function runTests() {
  console.log('🧪 Starting Vercel Serverless Function Tests...\n');

  // Ensure clean state
  resetPrice();

  // Test 1: Default GET /api/price
  console.log('Test 1: GET /api/price?item=coffee (default state)');
  {
    const { req, res } = mockReqRes({ method: 'GET', query: { item: 'coffee' } });
    await priceHandler(req, res);

    assert.strictEqual(res._getStatusCode(), 200);
    const data = res._getData();
    console.log('  Response:', data);

    assert.strictEqual(data.item, 'coffee');
    assert.strictEqual(data.price_cents, 7500, 'Default price should be 7500');
    assert.strictEqual(data.unit, 'kg');
    assert.strictEqual(typeof data.ts, 'number');
    assert(Number.isInteger(data.ts), 'ts must be integer');
    assert(data.ts > 1700000000 && data.ts < 2500000000, 'ts must be current unix timestamp in seconds');
    assert(data.supplier_address.startsWith('0x'), 'supplier_address must start with 0x');
    assert.strictEqual(data.supplier_address.length, 66, 'supplier_address must be 66 characters (0x + 64 hex chars)');
    assert.strictEqual(data.sig.length, 128, 'sig must be 128 hex characters');
    console.log('  ✅ Test 1 Passed\n');
  }

  // Test 2: Signature verification against public key
  console.log('Test 2: Exact byte match signature verification');
  {
    const { req, res } = mockReqRes({ method: 'GET', query: { item: 'coffee' } });
    await priceHandler(req, res);
    const data = res._getData();

    const expectedMsg = `${data.item}|${data.price_cents}|${data.ts}|${data.supplier_address.replace(/^0x/i, '').toLowerCase()}`;
    console.log('  Signed message:', expectedMsg);

    const keyInfo = parsePrivateKey(process.env.SUI_PRIVATE_KEY);
    const kp = keyInfo.seed ? nacl.sign.keyPair.fromSeed(keyInfo.seed) : nacl.sign.keyPair.fromSecretKey(keyInfo.secretKey);
    const sigBytes = Buffer.from(data.sig, 'hex');
    const msgBytes = Buffer.from(expectedMsg, 'utf8');

    const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, kp.publicKey);
    assert.strictEqual(isValid, true, 'Signature must verify with the corresponding public key');
    console.log('  ✅ Test 2 Passed: Signature is cryptographically valid\n');
  }

  // Test 3: POST /api/set-price with {"price_cents": 950}
  console.log('Test 3: POST /api/set-price with {"price_cents": 950}');
  {
    const { req, res } = mockReqRes({
      method: 'POST',
      body: { price_cents: 950 }
    });
    await setPriceHandler(req, res);

    assert.strictEqual(res._getStatusCode(), 200);
    const data = res._getData();
    console.log('  Response:', data);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.price_cents, 950);
    assert.strictEqual(getPrice(), 950);
    console.log('  ✅ Test 3 Passed\n');
  }

  // Test 4: GET /api/price after POST override
  console.log('Test 4: GET /api/price returns overridden price 950');
  {
    const { req, res } = mockReqRes({ method: 'GET', query: { item: 'coffee' } });
    await priceHandler(req, res);

    assert.strictEqual(res._getStatusCode(), 200);
    const data = res._getData();
    console.log('  Response:', data);
    assert.strictEqual(data.price_cents, 950, 'Price should now be 950');
    assert.strictEqual(data.sig.length, 128);
    console.log('  ✅ Test 4 Passed\n');
  }

  // Test 5: Validation - reject floats or invalid price_cents
  console.log('Test 5: POST /api/set-price rejects invalid inputs (floats, negatives, strings)');
  {
    // Float
    const { req: req1, res: res1 } = mockReqRes({ method: 'POST', body: { price_cents: 9.5 } });
    await setPriceHandler(req1, res1);
    assert.strictEqual(res1._getStatusCode(), 400, 'Float should be rejected');

    // Negative
    const { req: req2, res: res2 } = mockReqRes({ method: 'POST', body: { price_cents: -50 } });
    await setPriceHandler(req2, res2);
    assert.strictEqual(res2._getStatusCode(), 400, 'Negative price should be rejected');

    // Missing field
    const { req: req3, res: res3 } = mockReqRes({ method: 'POST', body: {} });
    await setPriceHandler(req3, res3);
    assert.strictEqual(res3._getStatusCode(), 400, 'Missing price_cents should be rejected');

    console.log('  ✅ Test 5 Passed: Validation correctly rejects invalid payloads\n');
  }

  // Test 6: Method check and OPTIONS preflight
  console.log('Test 6: Method check & CORS preflight');
  {
    const { req: optReq, res: optRes } = mockReqRes({ method: 'OPTIONS' });
    await priceHandler(optReq, optRes);
    assert.strictEqual(optRes._getStatusCode(), 200);
    assert.strictEqual(optRes._getHeaders()['Access-Control-Allow-Origin'], '*');

    const { req: postReq, res: postRes } = mockReqRes({ method: 'DELETE' });
    await priceHandler(postReq, postRes);
    assert.strictEqual(postRes._getStatusCode(), 405);
    console.log('  ✅ Test 6 Passed\n');
  }

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
