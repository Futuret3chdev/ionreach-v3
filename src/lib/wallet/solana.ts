import type { WalletSession } from "./session";

type SolProvider = {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
};

export type SolanaWallet = { id: string; name: string; provider: SolProvider };

function named(provider: SolProvider, fallback: string): string {
  if (provider.isPhantom) return "Phantom";
  if (provider.isSolflare) return "Solflare";
  if (provider.isBackpack) return "Backpack";
  return fallback;
}

export type MobileWalletApp = {
  id: "phantom" | "solflare" | "backpack";
  name: string;
};

/** Opens this page inside the wallet's own browser, where the app can connect. */
export function mobileWalletLink(id: MobileWalletApp["id"], page: string): string {
  const url = encodeURIComponent(page);
  let origin = page;
  try {
    origin = new URL(page).origin;
  } catch {
    origin = page;
  }
  const ref = encodeURIComponent(origin);
  if (id === "phantom") return `https://phantom.app/ul/browse/${url}?ref=${ref}`;
  if (id === "solflare") return `https://solflare.com/ul/v1/browse/${url}?ref=${ref}`;
  return `https://backpack.app/ul/v1/browse/${url}?ref=${ref}`;
}

export const MOBILE_WALLETS: MobileWalletApp[] = [
  { id: "phantom", name: "Phantom" },
  { id: "solflare", name: "Solflare" },
  { id: "backpack", name: "Backpack" },
];

export function insideWalletApp(): MobileWalletApp["id"] | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    solana?: SolProvider;
    phantom?: { solana?: SolProvider };
    solflare?: SolProvider;
    backpack?: SolProvider;
  };
  if (w.phantom?.solana?.isPhantom || w.solana?.isPhantom) return "phantom";
  if (w.solflare?.isSolflare) return "solflare";
  if (w.backpack?.isBackpack) return "backpack";
  return null;
}

export function listSolanaWallets(): SolanaWallet[] {
  const w = window as Window & {
    solana?: SolProvider;
    phantom?: { solana?: SolProvider };
    solflare?: SolProvider;
    backpack?: SolProvider;
  };
  const found: SolanaWallet[] = [];
  const push = (id: string, provider: SolProvider | undefined, fallback: string) => {
    if (!provider?.connect) return;
    const name = named(provider, fallback);
    if (found.some((row) => row.name === name)) return;
    found.push({ id, name, provider });
  };
  push("solana", w.solana, "Solana wallet");
  push("phantom", w.phantom?.solana, "Phantom");
  push("solflare", w.solflare, "Solflare");
  push("backpack", w.backpack, "Backpack");
  return found;
}

export async function connectSolana(id: string): Promise<WalletSession> {
  const wallet = listSolanaWallets().find((row) => row.id === id);
  if (!wallet) throw new Error("That Solana wallet is not available.");
  const res = await wallet.provider.connect();
  return { family: "solana", address: res.publicKey.toString(), walletName: wallet.name };
}
