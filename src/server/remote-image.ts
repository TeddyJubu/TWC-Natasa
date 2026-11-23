// Downloads an image an admin linked, for the cover cache (covers.ts). The address is someone else's server, so nothing
// about it is trusted: https on the standard port only, no credentials, and every connection (each redirect too) may
// reach public addresses only. The check runs inside the socket's own DNS lookup, so the address approved is the address
// connected to and a rebinding DNS answer has no second lookup to slip through. No cookies, auth or referrer are sent.
import dns from "node:dns";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.31.196.0", 24], ["192.52.193.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["192.175.48.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
// Inside global unicast (2000::/3): IETF special use (Teredo included), documentation, 6to4 (it wraps any IPv4) and AS112.
const V6_SPECIAL: [string, number][] = [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["2620:4f:8000::", 48], ["3fff::", 20]];

const blockedV4 = new BlockList();
for (const [net, prefix] of V4_BLOCKED) blockedV4.addSubnet(net, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const specialV6 = new BlockList();
for (const [net, prefix] of V6_SPECIAL) specialV6.addSubnet(net, prefix, "ipv6");

/**
 * True only for a public unicast address. IPv6 is an allowlist (global unicast minus special ranges), so loopback,
 * link-local, unique-local, multicast, NAT64 and IPv4-mapped forms are all refused.
 */
export function isPublicAddress(ip: string): boolean {
  try {
    const family = isIP(ip);
    if (family === 4) return !blockedV4.check(ip, "ipv4");
    return family === 6 && globalV6.check(ip, "ipv6") && !specialV6.check(ip, "ipv6");
  } catch {
    return false; // e.g. a zone id (fe80::1%eth0)
  }
}

export type RemoteFailure = "url" | "address" | "redirects" | "status" | "size" | "timeout" | "network";
/** Why a download stopped. Only `reason` is ever logged: a linked address can carry a token. */
export class RemoteImageError extends Error {
  readonly reason: RemoteFailure;
  constructor(reason: RemoteFailure) {
    super(`remote image: ${reason}`);
    this.reason = reason;
  }
}

export type RemoteOptions = {
  maxBytes?: number; maxRedirects?: number; timeoutMs?: number; idleMs?: number;
  /** For tests: which addresses may be connected to, and the transport. */
  allow?: (ip: string) => boolean;
  request?: (options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;
};

const DEFAULTS = {
  maxBytes: 5 * 1024 * 1024, maxRedirects: 3, timeoutMs: 10_000, idleMs: 5_000,
  allow: isPublicAddress, request: https.request as NonNullable<RemoteOptions["request"]>,
};
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const bareHost = (url: URL) => url.hostname.replace(/^\[|\]$/g, "");

/** The address as a URL if it may be fetched at all. An IP literal is checked here: a socket skips DNS for one. */
export function checkRemoteUrl(value: string, allow: (ip: string) => boolean = isPublicAddress): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RemoteImageError("url");
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password || !url.hostname) throw new RemoteImageError("url");
  const host = bareHost(url);
  if (isIP(host) && !allow(host)) throw new RemoteImageError("address");
  return url;
}

/** DNS for the socket itself. One non-public answer refuses the host, so a mixed answer can't be raced. */
const guardedLookup = (allow: (ip: string) => boolean): LookupFunction => (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    if (!addresses.length || addresses.some((a) => !allow(a.address))) return callback(new RemoteImageError("address"), "", 0);
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};

type Hop = { bytes: Uint8Array } | { location: string };

function getOnce(url: URL, o: typeof DEFAULTS, signal: AbortSignal): Promise<Hop> {
  return new Promise<Hop>((resolve, reject) => {
    const fail = (reason: RemoteFailure) => {
      reject(new RemoteImageError(signal.aborted ? "timeout" : reason));
      req.destroy();
    };
    const req = o.request({
      protocol: "https:", hostname: bareHost(url), port: 443, path: url.pathname + url.search, method: "GET",
      agent: false, lookup: guardedLookup(o.allow), signal, timeout: o.idleMs,
      headers: { Accept: "image/webp,image/png,image/jpeg", "Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0 (compatible; CoverFetcher/1.0)" },
    }, (res) => {
      const peer = res.socket?.remoteAddress;
      if (peer && !o.allow(peer)) return fail("address");
      const status = res.statusCode ?? 0;
      if (REDIRECTS.has(status)) {
        const { location } = res.headers;
        if (!location) return fail("status");
        resolve({ location });
        return void req.destroy();
      }
      if (status !== 200) return fail("status");
      if (Number(res.headers["content-length"]) > o.maxBytes) return fail("size");
      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > o.maxBytes) return fail("size");
        chunks.push(chunk);
        return undefined;
      });
      res.on("end", () => (res.complete ? resolve({ bytes: new Uint8Array(Buffer.concat(chunks)) }) : fail("network")));
      res.on("error", () => fail("network"));
      return undefined;
    });
    req.on("timeout", () => fail("timeout"));
    req.on("error", (error) => reject(error instanceof RemoteImageError ? error : new RemoteImageError(signal.aborted ? "timeout" : "network")));
    req.end();
  });
}

/** The file's bytes. Each redirect is checked like the first address; one deadline covers the whole download. */
export async function fetchRemoteImage(source: string, options: RemoteOptions = {}): Promise<Uint8Array> {
  const o = { ...DEFAULTS, ...options };
  const signal = AbortSignal.timeout(o.timeoutMs);
  let url = checkRemoteUrl(source, o.allow);
  for (let hop = 0; ; hop++) {
    const result = await getOnce(url, o, signal);
    if ("bytes" in result) return result.bytes;
    if (hop >= o.maxRedirects) throw new RemoteImageError("redirects");
    let next: string;
    try {
      next = new URL(result.location, url).href;
    } catch {
      throw new RemoteImageError("url");
    }
    url = checkRemoteUrl(next, o.allow);
  }
}
