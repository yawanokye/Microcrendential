import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeReadableHtml, textToReadableHtml } from "../src/lib/document-content";

test("plain manuals become structured learner HTML", () => {
  const html = textToReadableHtml([
    "MODULE 1: FOUNDATIONS",
    "This module introduces the central ideas used throughout the course.",
    "1.1 Evidence and context",
    "Evidence must be interpreted in its setting.",
    "LEARNING ACTIVITIES",
    "- Read the case study",
    "- Record your observations",
  ].join("\n"));

  assert.match(html, /<h2>MODULE 1: FOUNDATIONS<\/h2>/);
  assert.match(html, /<h3>1\.1 Evidence and context<\/h3>/);
  assert.match(html, /<h2>LEARNING ACTIVITIES<\/h2>/);
  assert.match(html, /<ul><li>Read the case study<\/li><li>Record your observations<\/li><\/ul>/);
});

test("learner HTML strips active content while retaining reading structure", () => {
  const html = sanitizeReadableHtml('<h2>Topic</h2><script>alert("x")</script><p>Safe text</p><a href="javascript:alert(1)">Unsafe link</a>');
  assert.equal(html.includes("script"), false);
  assert.equal(html.includes("javascript:"), false);
  assert.match(html, /<h2>Topic<\/h2><p>Safe text<\/p><a>Unsafe link<\/a>/);
});
