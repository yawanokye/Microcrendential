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
