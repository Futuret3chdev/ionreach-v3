import { readProjectId, type WalletSession } from "./session";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  disconnect?: () => Promise<void>;
  providers?: Eip1193[];
};

export type DiscoveredWallet = {
  id: string;
  name: string;
  icon?: string;
  family: "evm" | "solana";
  rdns?: string;
};

type Eip6963Detail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193;
};

const evmProviders = new Map<string, Eip6963Detail>();
const listeners = new Set<() => void>();
let started = false;
let wcProvider: (Eip1193 & { disconnect: () => Promise<void> }) | null = null;

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeWallets(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function startWalletDiscovery(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (!detail?.info?.uuid || !detail.provider) return;
    evmProviders.set(detail.info.uuid, detail);
    emit();
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.setTimeout(() => window.dispatchEvent(new Event("eip6963:requestProvider")), 400);
}

export function listWallets(): DiscoveredWallet[] {
  const found: DiscoveredWallet[] = [];
  for (const detail of evmProviders.values()) {
    found.push({
      id: `evm:${detail.info.uuid}`,
      name: detail.info.name,
      icon: detail.info.icon,
      family: "evm",
      rdns: detail.info.rdns,
    });
  }
  const eth = (window as Window & { ethereum?: Eip1193 }).ethereum;
  if (eth && found.length === 0) {
    const nested = eth.providers?.length ? eth.providers : [eth];
    nested.forEach((provider, i) => {
      const name = (provider as Eip1193 & { isMetaMask?: boolean; isRabby?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean; isPhantom?: boolean }).isRabby
        ? "Rabby"
        : (provider as { isCoinbaseWallet?: boolean }).isCoinbaseWallet
          ? "Coinbase Wallet"
          : (provider as { isBraveWallet?: boolean }).isBraveWallet
            ? "Brave Wallet"
            : (provider as { isPhantom?: boolean }).isPhantom
              ? "Phantom"
              : (provider as { isMetaMask?: boolean }).isMetaMask
                ? "MetaMask"
                : "Browser wallet";
      found.push({ id: `injected:${i}`, name, family: "evm" });
      evmProviders.set(`injected:${i}`, {
        info: { uuid: `injected:${i}`, name, icon: "", rdns: name },
        provider,
      });
    });
  }
  const sol = solanaProvider();
  if (sol) {
    found.push({
      id: "solana:injected",
      name: sol.name || "Solana wallet",
      icon: sol.icon,
      family: "solana",
    });
  }
  const seen = new Set<string>();
  return found.filter((w) => {
    const key = `${w.family}:${w.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function solanaProvider(): { connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void>; name?: string; icon?: string } | null {
  const w = window as Window & {
    solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void>; isPhantom?: boolean; isSolflare?: boolean };
    phantom?: { solana?: { connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void> } };
    solflare?: { connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void> };
  };
  if (w.solana?.connect) {
    return {
      ...w.solana,
      name: w.solana.isPhantom ? "Phantom" : w.solana.isSolflare ? "Solflare" : "Solana wallet",
    };
  }
  if (w.phantom?.solana?.connect) return { ...w.phantom.solana, name: "Phantom" };
  if (w.solflare?.connect) return { ...w.solflare, name: "Solflare" };
  return null;
}

async function evmSession(provider: Eip1193, name: string, rdns?: string): Promise<WalletSession> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("Wallet did not return an account.");
  let chainId: string | undefined;
  try {
    chainId = String(await provider.request({ method: "eth_chainId" }));
  } catch {
    chainId = undefined;
  }
  provider.on?.("accountsChanged", (next) => {
    const list = next as string[];
    if (!list?.length) {
      import("./session").then(({ writeSession }) => writeSession(null));
      emit();
    }
  });
  return { family: "evm", address, walletName: name, chainId, rdns };
}

export async function connectWallet(id: string): Promise<WalletSession> {
  startWalletDiscovery();
  if (id === "walletconnect") return connectWalletConnect();
  if (id === "solana:injected") {
    const sol = solanaProvider();
    if (!sol) throw new Error("No Solana wallet found in this browser.");
    const res = await sol.connect();
    const address = res.publicKey.toString();
    return { family: "solana", address, walletName: sol.name || "Solana wallet" };
  }
  const detail = [...evmProviders.values()].find((d) => `evm:${d.info.uuid}` === id || d.info.uuid === id);
  if (!detail) throw new Error("That wallet is no longer available. Reopen the connect panel.");
  return evmSession(detail.provider, detail.info.name, detail.info.rdns);
}

export async function connectWalletConnect(): Promise<WalletSession> {
  const projectId = readProjectId();
  if (!projectId) {
    throw new Error("WalletConnect is unavailable right now. Installed browser wallets still work.");
  }
  const mod = await import("@walletconnect/ethereum-provider");
  const EthereumProvider = mod.default;
  const origin = window.location.origin;
  const provider = await EthereumProvider.init({
    projectId,
    showQrModal: true,
    metadata: {
      name: "IONREACH",
      description: "IONREACH: Glass Horizon — connect any wallet",
      url: origin,
      icons: [`${origin}/brand/futuret3ch.png`],
    },
    optionalChains: [1, 137, 8453, 42161, 10, 56, 43114, 324, 59144, 81457],
    rpcMap: {
      1: "https://cloudflare-eth.com",
      137: "https://polygon-rpc.com",
      8453: "https://mainnet.base.org",
      42161: "https://arb1.arbitrum.io/rpc",
      10: "https://mainnet.optimism.io",
      56: "https://bsc-dataseed.binance.org",
    },
  });
  await provider.connect();
  wcProvider = provider;
  return evmSession(provider, "WalletConnect");
}

export async function disconnectWallet(): Promise<void> {
  try {
    await wcProvider?.disconnect();
  } catch {
    /* already closed */
  }
  wcProvider = null;
  try {
    await solanaProvider()?.disconnect?.();
  } catch {
    /* optional */
  }
}
