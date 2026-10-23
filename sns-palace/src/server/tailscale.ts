// Asks the Tailscale container for this device's address over its LocalAPI
// socket, so "Add a device" can offer a QR code that works away from home even
// when the parent room was opened as http://localhost:3000.

import { request } from "node:http";
import type { TailscaleStatus } from "@/lib/types";
import { getTailscaleConfig } from "@/server/config";

/** The parts of tailscaled's /localapi/v0/status that matter here. */
export interface LocalApiStatus {
  BackendState?: string;
  AuthURL?: string;
  Self?: { DNSName?: string } | null;
  CertDomains?: string[] | null;
}

/** GET /localapi/v0/status over the unix socket; null if it can't be read. */
export function readStatus(socketPath: string, timeoutMs = 2000): Promise<LocalApiStatus | null> {
  return new Promise((resolve) => {
    const req = request(
      // tailscaled ignores the host, but HTTP needs one.
      { socketPath, path: "/localapi/v0/status", headers: { host: "local-tailscaled.sock" }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as LocalApiStatus);
          } catch {
            resolve(null);
          }
        });
        res.on("error", () => resolve(null));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
}

export function interpretStatus(status: LocalApiStatus | null): TailscaleStatus {
  if (!status) return { state: "off" };
  if (status.BackendState !== "Running") return { state: "not-connected", loginUrl: status.AuthURL || null };
  // MagicDNS names end with a dot: "sns-palace.tail1234.ts.net."
  const name = status.Self?.DNSName?.replace(/\.$/, "");
  if (!name) return { state: "not-connected", loginUrl: null };
  if (!status.CertDomains?.includes(name)) return { state: "https-off", name };
  return { state: "ready", url: `https://${name}/` };
}

export async function tailscaleStatus(): Promise<TailscaleStatus> {
  const { socket } = getTailscaleConfig();
  return socket ? interpretStatus(await readStatus(socket)) : { state: "off" };
}
