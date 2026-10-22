// Where an address SnS Palace is open at can be reached from.

export type AddressReach = "this-computer" | "home-network" | "anywhere";

const PRIVATE_IPV4 = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./];

export function addressReach(url: string): AddressReach {
  const host = new URL(url).hostname.toLowerCase();
  if (host === "localhost" || host === "[::1]" || host === "0.0.0.0" || host.startsWith("127.")) return "this-computer";
  if (PRIVATE_IPV4.some((range) => range.test(host))) return "home-network";
  // mDNS names (my-computer.local) and IPv6 link-local / unique local addresses.
  if (host.endsWith(".local") || /^\[(fe80|f[cd][0-9a-f]{2}):/.test(host)) return "home-network";
  return "anywhere";
}
