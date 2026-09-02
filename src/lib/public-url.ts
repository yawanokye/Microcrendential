import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const privateIpv4 = (address: string) => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] === 169 && parts[1] === 254
    || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168
    || parts[0] >= 224;
};

const privateIpv6 = (address: string) => {
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")
    || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")
    || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
};

export async function validatePublicHttpUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Use a public HTTP or HTTPS link without embedded credentials.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("Private network links cannot be imported.");
  const literal = isIP(hostname);
  if (literal === 4 && privateIpv4(hostname) || literal === 6 && privateIpv6(hostname)) throw new Error("Private network links cannot be imported.");
  if (!literal) {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length || addresses.some((item) => item.family === 4 ? privateIpv4(item.address) : privateIpv6(item.address))) throw new Error("The link does not resolve to a public internet address.");
  }
  return url;
}

export async function fetchPublicResource(raw: string, maximumBytes = 12 * 1024 * 1024) {
  let url = await validatePublicHttpUrl(raw);
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "UCC-Microcredentials-Content-Importer/1.0", accept: "text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain;q=0.9,*/*;q=0.5" } });
    } finally { clearTimeout(timeout); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); if (!location) throw new Error("The linked resource returned an invalid redirect.");
      url = await validatePublicHttpUrl(new URL(location, url).toString()); continue;
    }
    if (!response.ok) throw new Error(`The linked resource returned HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > maximumBytes) throw new Error("The linked resource is too large to convert safely.");
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > maximumBytes) throw new Error("The linked resource is too large to convert safely.");
    return { body, contentType: response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "application/octet-stream", finalUrl: url.toString() };
  }
  throw new Error("The linked resource redirected too many times.");
}
