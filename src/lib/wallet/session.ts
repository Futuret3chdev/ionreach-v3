export type WalletFamily = "evm" | "solana";

export type WalletSession = {
  family: WalletFamily;
  address: string;
  walletName: string;
  chainId?: string;
  rdns?: string;
};

const KEY = "ionreach.wallet.session";
const WC_KEY = "ionreach.walletconnect.projectId";

export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function readSession(): WalletSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletSession;
    if (!parsed?.address || !parsed.family) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: WalletSession | null): void {
  if (typeof localStorage === "undefined") return;
  if (!session) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(session));
}

const DEFAULT_PROJECT_ID = "574fee125941f8394ce78c08701e6d62";

export function readProjectId(): string {
  const fromEnv = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  if (fromEnv) return fromEnv;
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(WC_KEY);
    if (stored) return stored;
  }
  return DEFAULT_PROJECT_ID;
}

export function writeProjectId(id: string): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = id.trim();
  if (!trimmed) localStorage.removeItem(WC_KEY);
  else localStorage.setItem(WC_KEY, trimmed);
}
