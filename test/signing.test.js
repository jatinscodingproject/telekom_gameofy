const test = require('node:test');
const assert = require('node:assert');
const { signRequest, canonicalQueryFromObject, awsEncode } = require('../utils/awsV4');

test('matches the official AWS SigV4 "get-vanilla" test vector', () => {
  const r = signRequest({
    method: 'GET', host: 'example.amazonaws.com', path: '/', query: '', body: '',
    accessKey: 'AKIDEXAMPLE', accessSecret: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1', service: 'service', amzDate: '20150830T123600Z'
  });
  assert.strictEqual(r.signature, '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
  assert.strictEqual(r.credentialScope, '20150830/us-east-1/service/aws4_request');
});

test('empty body hash is the documented e3b0c442... value', () => {
  const { sha256 } = require('../utils/awsV4');
  assert.strictEqual(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('canonical request uses \\n only and has the blank line before signed headers', () => {
  const r = signRequest({ method: 'get', host: 'h.example', path: '/partner-vas-api/subscription/1', query: '', body: '',
    accessKey: 'k', accessSecret: 's', region: 'eu-west-1', service: 'execute-api', amzDate: '20240131T165559Z' });
  assert.ok(!r.canonicalRequest.includes('\r'));
  assert.strictEqual(r.canonicalRequest.split('\n')[0], 'GET');
  assert.ok(r.canonicalRequest.includes('x-amz-date:20240131T165559Z\n\nhost;x-amz-date\n'));
});

test('query: sorted by code point, space is %20 and the expand() example from the PDF encodes correctly', () => {
  assert.strictEqual(canonicalQueryFromObject({ page: 2, order: 'asc' }), 'order=asc&page=2');
  assert.strictEqual(canonicalQueryFromObject({ another: 2, First: 1 }), 'First=1&another=2');   // uppercase before lowercase
  assert.strictEqual(awsEncode('a b'), 'a%20b');
  const q = canonicalQueryFromObject({ expand: 'subscription(status=Active, page=1)' });
  assert.strictEqual(q, 'expand=subscription%28status%3DActive%2C%20page%3D1%29');
});

test('empty / undefined query values are dropped', () => {
  assert.strictEqual(canonicalQueryFromObject({ expand: undefined, a: '' }), '');
});
