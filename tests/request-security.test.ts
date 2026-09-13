import assert from "node:assert/strict";
import test from "node:test";
import { rejectCrossSiteMutation } from "../src/lib/request-security";

test("same-origin mutations are accepted", () => {
  const request = new Request("https://example.test/api/courses", { method: "POST", headers: { origin: "https://example.test" } });
  assert.equal(rejectCrossSiteMutation(request), null);
});

test("cross-origin mutations are rejected", async () => {
  const request = new Request("https://example.test/api/courses", { method: "POST", headers: { origin: "https://attacker.test" } });
  const response = rejectCrossSiteMutation(request);
  assert.equal(response?.status, 403);
  assert.match(await response!.text(), /origin/i);
});

test("same-site browser requests without Origin remain compatible", () => {
  const request = new Request("https://example.test/api/uploads", { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
  assert.equal(rejectCrossSiteMutation(request), null);
});

test("same-origin browser mutations survive an HTTPS reverse proxy", () => {
  const request = new Request("http://localhost:10000/api/render-auth", {
    method: "POST",
    headers: {
      origin: "https://ucc-microcredential-platform.onrender.com",
      "sec-fetch-site": "same-origin",
      "x-forwarded-host": "ucc-microcredential-platform.onrender.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(rejectCrossSiteMutation(request), null);
});

test("proxy origin is accepted when fetch metadata is unavailable", () => {
  const request = new Request("http://localhost:10000/api/render-auth", {
    method: "POST",
    headers: {
      origin: "https://ucc-microcredential-platform.onrender.com",
      "x-forwarded-host": "ucc-microcredential-platform.onrender.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(rejectCrossSiteMutation(request), null);
});

test("a foreign origin remains blocked behind the proxy", async () => {
  const request = new Request("http://localhost:10000/api/render-auth", {
    method: "POST",
    headers: {
      origin: "https://attacker.test",
      "sec-fetch-site": "cross-site",
      "x-forwarded-host": "ucc-microcredential-platform.onrender.com",
      "x-forwarded-proto": "https",
    },
  });
  const response = rejectCrossSiteMutation(request);
  assert.equal(response?.status, 403);
  assert.match(await response!.text(), /cross-site/i);
});
