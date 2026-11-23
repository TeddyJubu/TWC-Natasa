import dns from "node:dns";
import http, { type IncomingHttpHeaders, type RequestOptions, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TINY } from "@/test/images";
import { checkRemoteUrl, fetchRemoteImage, isPublicAddress, type RemoteOptions } from "./remote-image";

// A real local server stands in for the far end: the transport is plain http to it, and every other step (the socket's
// own guarded DNS lookup, redirects, limits) is the production code. `cover.test` resolves to it through a stubbed DNS.
let server: Server;
let port: number;
let connections = 0;
let seen: { url: string; headers: IncomingHttpHeaders }[] = [];
let handle: (req: http.IncomingMessage, res: http.ServerResponse) => void;

const transport: NonNullable<RemoteOptions["request"]> = (options: RequestOptions, callback) =>
  http.request({ ...options, protocol: "http:", port }, callback);
const local: RemoteOptions = { request: transport, allow: (ip) => ip === "127.0.0.1" || isPublicAddress(ip) };
const resolvesTo = (...addresses: string[]) =>
  vi.spyOn(dns, "lookup").mockImplementation(((_host: string, _options: unknown, callback: (e: null, a: { address: string; family: number }[]) => void) => {
    callback(null, addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
  }) as unknown as typeof dns.lookup);

beforeAll(async () => {
  server = http.createServer((req, res) => {
    seen.push({ url: req.url ?? "", headers: req.headers });
    handle(req, res);
  });
  server.on("connection", () => { connections++; });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise((done) => { server.close(done); }));
afterEach(() => {
  vi.restoreAllMocks();
  seen = [];
  connections = 0;
});

describe("isPublicAddress", () => {
  it.each([
    "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "127.255.255.254", "169.254.169.254", "172.16.0.1", "172.31.255.255", "172.18.0.1",
    "192.0.0.1", "192.0.2.1", "192.88.99.1", "192.168.1.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "239.255.255.255", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fe80::1", "fe80::1%eth0", "fc00::1", "fd00:ec2::254", "ff02::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:8.8.8.8",
    "64:ff9b::7f00:1", "100::1", "2001::1", "2001:db8::1", "2002:7f00:1::1", "3fff::1", "not-an-ip", "",
  ])("refuses %s", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it.each(["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "192.167.1.1", "2606:4700:4700::1111", "2a00:1450:4001::1"])("allows %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
});

describe("checkRemoteUrl", () => {
  it.each([
    "http://example.com/a.jpg", "ftp://example.com/a.jpg", "file:///etc/passwd", "data:image/png;base64,AAAA", "not a url",
    "https://example.com:8443/a.jpg", "https://user:pass@example.com/a.jpg", "https://user@example.com/a.jpg",
    "https://127.0.0.1/a.jpg", "https://[::1]/a.jpg", "https://[::ffff:127.0.0.1]/a.jpg", "https://169.254.169.254/latest/meta-data",
    // WHATWG URL parsing turns these spellings into 127.0.0.1, and they are checked as that.
    "https://2130706433/a.jpg", "https://0x7f.0.0.1/a.jpg", "https://0177.0.0.1/a.jpg", "https://127.1/a.jpg",
  ])("refuses %s", (url) => expect(() => checkRemoteUrl(url)).toThrow(/remote image/));

  it("accepts https on the standard port, written or not", () => {
    expect(checkRemoteUrl("https://example.com/a.jpg?w=1").hostname).toBe("example.com");
    expect(checkRemoteUrl("https://example.com:443/a.jpg").port).toBe("");
  });
});

describe("fetchRemoteImage", () => {
  it("downloads an image and sends no cookie, auth or referrer", async () => {
    resolvesTo("127.0.0.1");
    handle = (_req, res) => res.end(TINY.png);
    expect(await fetchRemoteImage("https://cover.test/a.png?x=1", local)).toEqual(TINY.png);
    expect(seen[0].url).toBe("/a.png?x=1");
    for (const name of ["cookie", "authorization", "referer", "origin", "x-forwarded-for"]) expect(seen[0].headers[name]).toBeUndefined();
  });

  it.each([["a private address", ["10.0.0.5"]], ["loopback", ["127.0.0.1"]], ["the metadata address", ["169.254.169.254"]], ["IPv6 loopback", ["::1"]], ["a mix of public and private", ["8.8.8.8", "127.0.0.1"]]])(
    "never connects when DNS answers %s",
    async (_name, addresses) => {
      resolvesTo(...addresses);
      handle = (_req, res) => res.end(TINY.png);
      await expect(fetchRemoteImage("https://cover.test/a.png", { request: transport })).rejects.toMatchObject({ reason: "address" });
      expect(connections).toBe(0);
    },
  );

  it("checks DNS at connect time on every connection: a host that rebinds to a private address is refused", async () => {
    const answers = ["127.0.0.1", "10.0.0.9"];
    const lookup = vi.spyOn(dns, "lookup").mockImplementation(((_h: string, _o: unknown, cb: (e: null, a: { address: string; family: number }[]) => void) => {
      cb(null, [{ address: answers.shift()!, family: 4 }]);
    }) as unknown as typeof dns.lookup);
    handle = (_req, res) => res.writeHead(302, { Location: "https://cover.test/again.png" }).end();
    await expect(fetchRemoteImage("https://cover.test/a.png", { request: transport, allow: (ip) => ip === "127.0.0.1" })).rejects.toMatchObject({ reason: "address" });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(seen).toHaveLength(1);
    expect(connections).toBe(1);
  });

  it("also refuses a response whose socket ended up on a blocked address", async () => {
    resolvesTo("127.0.0.1");
    handle = (_req, res) => res.end(TINY.png);
    let calls = 0;
    const allow = () => ++calls === 1; // the lookup passes, the connected peer doesn't
    await expect(fetchRemoteImage("https://cover.test/a.png", { request: transport, allow })).rejects.toMatchObject({ reason: "address" });
    expect(calls).toBe(2);
  });

  it.each([
    ["a private IP", "https://10.0.0.1/a.png", "address"],
    ["the metadata address", "https://169.254.169.254/latest/meta-data", "address"],
    ["IPv6 loopback", "https://[::1]/a.png", "address"],
    ["plain http", "http://example.com/a.png", "url"],
    ["another port", "https://example.com:8443/a.png", "url"],
    ["credentials", "https://user:pw@example.com/a.png", "url"],
  ])("refuses a redirect to %s", async (_name, location, reason) => {
    resolvesTo("127.0.0.1");
    handle = (_req, res) => res.writeHead(302, { Location: location }).end();
    await expect(fetchRemoteImage("https://cover.test/a.png", { ...local, allow: (ip) => ip === "127.0.0.1" })).rejects.toMatchObject({ reason });
    expect(seen).toHaveLength(1);
  });

  it("refuses a redirect to a name that resolves to a blocked address", async () => {
    const lookup = vi.spyOn(dns, "lookup").mockImplementation(((host: string, _o: unknown, cb: (e: null, a: { address: string; family: number }[]) => void) => {
      cb(null, [{ address: host === "cover.test" ? "127.0.0.1" : "10.0.0.9", family: 4 }]);
    }) as unknown as typeof dns.lookup);
    handle = (_req, res) => res.writeHead(302, { Location: "https://internal.test/a.png" }).end();
    await expect(fetchRemoteImage("https://cover.test/a.png", { request: transport, allow: (ip) => ip === "127.0.0.1" })).rejects.toMatchObject({ reason: "address" });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(connections).toBe(1);
  });

  it("follows a few redirects, then stops", async () => {
    resolvesTo("127.0.0.1");
    handle = (req, res) => {
      const n = Number(/\/(\d+)$/.exec(req.url ?? "")?.[1] ?? 0);
      if (n < 3) res.writeHead(302, { Location: `/${n + 1}` }).end();
      else res.end(TINY.png);
    };
    expect(await fetchRemoteImage("https://cover.test/0", local)).toEqual(TINY.png);
    seen = [];
    handle = (req, res) => res.writeHead(302, { Location: `${req.url}x` }).end();
    await expect(fetchRemoteImage("https://cover.test/a", local)).rejects.toMatchObject({ reason: "redirects" });
    expect(seen).toHaveLength(4); // the first request plus three redirects
  });

  it("refuses a declared oversize file before reading it", async () => {
    resolvesTo("127.0.0.1");
    handle = (_req, res) => { res.writeHead(200, { "Content-Length": "2000" }); res.write("x"); };
    await expect(fetchRemoteImage("https://cover.test/a", { ...local, maxBytes: 1000 })).rejects.toMatchObject({ reason: "size" });
  });

  it("stops an undeclared oversize stream at the limit", async () => {
    resolvesTo("127.0.0.1");
    let closed = false;
    handle = (_req, res) => {
      res.on("close", () => { closed = true; });
      const timer = setInterval(() => res.write(Buffer.alloc(512)), 1);
      res.on("close", () => clearInterval(timer));
    };
    await expect(fetchRemoteImage("https://cover.test/a", { ...local, maxBytes: 2048 })).rejects.toMatchObject({ reason: "size" });
    await vi.waitFor(() => expect(closed).toBe(true));
  });

  it("gives up on a server that stops sending", async () => {
    resolvesTo("127.0.0.1");
    handle = (_req, res) => { res.writeHead(200); res.write("x"); };
    await expect(fetchRemoteImage("https://cover.test/a", { ...local, idleMs: 50 })).rejects.toMatchObject({ reason: "timeout" });
  });

  it("holds a slow drip to one overall deadline", async () => {
    resolvesTo("127.0.0.1");
    handle = (_req, res) => {
      res.writeHead(200);
      const timer = setInterval(() => res.write("x"), 10);
      res.on("close", () => clearInterval(timer));
    };
    await expect(fetchRemoteImage("https://cover.test/a", { ...local, timeoutMs: 120, idleMs: 5000 })).rejects.toMatchObject({ reason: "timeout" });
  });

  it("refuses an error status and a cut-off body", async () => {
    resolvesTo("127.0.0.1");
    handle = (_req, res) => res.writeHead(403).end("no");
    await expect(fetchRemoteImage("https://cover.test/a", local)).rejects.toMatchObject({ reason: "status" });
    handle = (_req, res) => { res.writeHead(200, { "Content-Length": "100" }); res.write("short"); setTimeout(() => res.destroy(), 5); };
    await expect(fetchRemoteImage("https://cover.test/a", local)).rejects.toMatchObject({ reason: "network" });
  });
});
