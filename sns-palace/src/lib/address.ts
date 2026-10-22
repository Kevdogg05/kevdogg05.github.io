// Where an address SnS Palace is open at can be reached from.

export type AddressReach = "this-computer" | "home-network" | "tailnet" | "anywhere";

const PRIVATE_IPV4 = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./];
// Tailscale's MagicDNS names and its 100.64.0.0/10 device addresses.
const TAILNET = [/\.ts\.net$/, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

export function addressReach(url: string): AddressReach {
  const host = new URL(url).hostname.toLowerCase();
  if (host === "localhost" || host === "[::1]" || host === "0.0.0.0" || host.startsWith("127.")) return "this-computer";
  if (PRIVATE_IPV4.some((range) => range.test(host))) return "home-network";
  if (TAILNET.some((range) => range.test(host))) return "tailnet";
  // mDNS names (my-computer.local) and IPv6 link-local / unique local addresses.
  if (host.endsWith(".local") || /^\[(fe80|f[cd][0-9a-f]{2}):/.test(host)) return "home-network";
  return "anywhere";
}
