import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { connectSolana, insideWalletApp, listSolanaWallets, mobileWalletLink, MOBILE_WALLETS, type SolanaWallet } from "@/lib/wallet/solana";
import { readSession, shortAddress, writeSession, type WalletSession } from "@/lib/wallet/session";
import { BUY_URL, T3X_MINT, t3xBalance } from "@/lib/wallet/t3x";


function onPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function pairUrl(id: string): string {
  return `https://mt.futuret3ch.com.au/?connect=ionreach&session=${id}`;
}

export function WalletDock() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [pair, setPair] = useState("");
  const [linked, setLinked] = useState<WalletSession | null>(null);
  const [wallets, setWallets] = useState<SolanaWallet[]>([]);
  const [inside, setInside] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    setPhone(onPhone());
    setPair(crypto.randomUUID());
    setLinked(readSession());
    setWallets(listSolanaWallets());
    setInside(insideWalletApp());
  }, [open]);

  useEffect(() => {
    const refresh = () => {
      setWallets(listSolanaWallets());
      setInside(insideWalletApp());
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  async function onConnect(id: string) {
    setBusy(id);
    setError("");
    try {
      const next = await connectSolana(id);
      const held = await t3xBalance(next.address);
      setBalance(held);
      if (T3X_MINT && (held ?? 0) <= 0) {
        writeSession(null);
        setLinked(null);
        setError("This wallet has no T3X. Buy T3X, then connect again.");
        return;
      }
      writeSession(next);
      setLinked(next);
      if (!T3X_MINT) setError("Connected. Holder check turns on when the T3X mint is set.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setBusy(null);
    }
  }

  function openApp() {
    const url = pairUrl(pair);
    window.location.href = url;
  }

  const page = typeof window === "undefined" ? "" : window.location.href;
  const phantomLink = page ? mobileWalletLink("phantom", page) : "";
  const qr = phantomLink ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(phantomLink)}` : "";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 border border-line bg-surface/80 px-5 font-display text-lg text-fg">
        <Wallet className="size-4" />
        {linked ? shortAddress(linked.address) : "Connect wallet"}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bg/70 p-4 md:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto border border-line bg-surface p-5">
            <p className="font-display text-xs tracking-[0.22em] text-ion">SOLANA ONLY</p>
            <h2 className="font-display text-2xl font-semibold">T3X wallet</h2>
            <p className="mt-1 text-sm text-muted">
              {inside
                ? `You are inside ${inside}. Connect it below.`
                : phone
                  ? "On a phone, open this page in Phantom, Solflare, or Backpack. The app connects from there."
                  : "On a computer, scan with your phone camera. It opens this page in Phantom."}
            </p>
            {linked && (
              <div className="mt-3 border border-line px-3 py-2 text-sm">
                <p className="font-display text-ion">{linked.walletName}</p>
                <p className="break-all">{linked.address}</p>
                <button type="button" onClick={() => { writeSession(null); setLinked(null); setBalance(null); }} className="mt-2 min-h-11 text-ember">
                  Disconnect
                </button>
              </div>
            )}
            {!inside && (
              <div className="mt-4 grid gap-2">
                {MOBILE_WALLETS.map((app) => (
                  <a
                    key={app.id}
                    href={page ? mobileWalletLink(app.id, page) : "#"}
                    className={
                      app.id === "phantom"
                        ? "inline-flex min-h-11 w-full items-center justify-center bg-ion px-4 font-display text-bg"
                        : "inline-flex min-h-11 w-full items-center justify-center border border-line px-4 font-display"
                    }
                  >
                    Open {app.name}
                  </a>
                ))}
              </div>
            )}
            {!phone && !inside && (
              <div className="mt-4 flex flex-col items-center gap-2">
                {qr && <img src={qr} alt="Scan to open this page in Phantom" width={220} height={220} />}
                <p className="text-center text-xs text-muted">Scan with the phone camera. Phantom opens this page.</p>
              </div>
            )}
            {phone && (
              <button type="button" onClick={openApp} className="mt-3 min-h-11 w-full border border-line px-4 font-display">
                Open Infinite Wallet
              </button>
            )}
            <p className="mt-4 font-display text-xs tracking-[0.16em] text-muted">OR A BROWSER WALLET</p>
            <ul className="mt-2 space-y-2">
              {wallets.map((w) => (
                <li key={w.id}>
                  <button type="button" disabled={busy !== null} onClick={() => onConnect(w.id)} className="flex min-h-11 w-full items-center border border-line px-3 text-left font-display">
                    {busy === w.id ? "Waiting…" : w.name}
                  </button>
                </li>
              ))}
              {wallets.length === 0 && <li className="text-sm text-muted">No wallet is injected in this browser yet. Open Phantom above, then connect.</li>}
            </ul>
            {BUY_URL ? (
              <a href={BUY_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center bg-ion px-4 font-display text-bg">
                Buy T3X
              </a>
            ) : (
              <p className="mt-3 text-sm text-muted">Buy opens on Jupiter once the T3X mint is set.</p>
            )}
            {balance != null && <p className="mt-2 text-sm text-muted">Balance {balance} T3X</p>}
            {error && <p className="mt-2 text-sm text-ember">{error}</p>}
            <button type="button" onClick={() => setOpen(false)} className="mt-4 min-h-11 px-3 font-display text-muted">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
