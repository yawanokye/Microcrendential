import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeReadableHtml } from "../src/lib/document-content";

test("readable course HTML preserves safe figures and authorised inline images", () => {
  const html = sanitizeReadableHtml('<figure><img src="/api/course-materials?key=course-materials%2Flesson-diagram.png" alt="Supply chain diagram"><figcaption>Supply chain flow</figcaption></figure>');
  assert.match(html, /<figure>/);
  assert.match(html, /src="\/api\/course-materials\?key=course-materials%2Flesson-diagram\.png"/);
  assert.match(html, /alt="Supply chain diagram"/);
  assert.match(html, /<figcaption>Supply chain flow<\/figcaption>/);
});

test("readable course HTML permits HTTPS images but removes unsafe image sources", () => {
  const html = sanitizeReadableHtml('<img src="https://example.edu/diagram.png" alt="Safe"><img src="javascript:alert(1)" alt="Unsafe"><script>alert(2)</script>');
  assert.match(html, /https:\/\/example\.edu\/diagram\.png/);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /script/i);
  assert.doesNotMatch(html, /alert/i);
});
