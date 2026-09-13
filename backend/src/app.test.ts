import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAllowedOrigins } from './app';

test('CORS: trailing slash in config does not break matching', () => {
  const allowed = parseAllowedOrigins('https://wittehsieh.github.io/');
  assert.deepEqual(allowed, ['https://wittehsieh.github.io']);
});

test('CORS: multiple comma-separated origins, extra whitespace tolerated', () => {
  const allowed = parseAllowedOrigins(
    ' https://a.example.com/ , https://b.example.com ',
  );
  assert.deepEqual(allowed, ['https://a.example.com', 'https://b.example.com']);
});

test('CORS: falls back to localhost when unset', () => {
  assert.deepEqual(parseAllowedOrigins(undefined), ['http://localhost:5173']);
});
