import { useEffect, useState } from "react";
import { WalletDock } from "@/components/WalletDock";
import { linkProvider, PROVIDERS, readSecurity, saveSecurity, type ProviderId, type SecurityProfile } from "@/lib/meta/security";
import { buyItem, readProfile, readSaves, STOCK, toggleEquipped, type Profile, type SaveSlot, type ShopId } from "@/lib/meta/profile";

type Tab = "wallet" | "security" | "accounts" | "music" | "shop" | "saves";

export function SettingsPanel({
  open,
  onClose,
  musicOn,
  onMusic,
  onSave,
  onLoad,
}: {
  open: boolean;
  onClose: () => void;
  musicOn: boolean;
  onMusic: (on: boolean) => void;
  onSave: (index: number) => SaveSlot | null;
  onLoad: (slot: SaveSlot) => void;
}) {
  const [tab, setTab] = useState<Tab>("wallet");
  const [profile, setProfile] = useState<Profile>({ marks: 0, owned: [], equipped: [] });
  const [security, setSecurity] = useState<SecurityProfile>(readSecurity());
  const [saves, setSaves] = useState<(SaveSlot | null)[]>([null, null, null, null]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const next = readSecurity();
    setSecurity(next);
    setEmail(next.email);
    setPhone(next.phone);
    setProfile(readProfile());
    setSaves(readSaves());
  }, [open]);

  if (!open) return null;

  async function onSecurity(e: React.FormEvent) {
    e.preventDefault();
    const next = await saveSecurity({ email, phone, password });
    setSecurity(next);
    setPassword("");
    setNote("Security details saved on this device. Password is stored as a hash.");
  }

  function onLink(id: ProviderId) {
    const next = linkProvider(id);
    setSecurity(next);
    setNote("Reward reserved. It is not sent on-chain until the T3X treasury is connected.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/75 p-4 md:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="font-display text-xs tracking-[0.22em] text-ion">DIRECTORATE</p>
            <h2 className="font-display text-2xl font-semibold">Settings</h2>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 px-3 font-display text-muted">
            Close
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2">
          {(
            [
              ["wallet", "Wallet"],
              ["security", "Security"],
              ["accounts", "Accounts"],
              ["music", "Music"],
              ["shop", "Shop"],
              ["saves", "Saves"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? "min-h-11 bg-ion px-3 font-display text-bg" : "min-h-11 px-3 font-display text-muted"}>
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "wallet" && (
            <div>
              <p className="text-sm text-muted">Solana wallets only. Connect is accepted when the wallet holds T3X. Otherwise buy it first.</p>
              <div className="mt-4">
                <WalletDock />
              </div>
            </div>
          )}
          {tab === "security" && (
            <form onSubmit={onSecurity} className="space-y-3">
              <label className="block text-xs text-muted">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1 min-h-11 w-full border border-line bg-bg px-3 text-fg" />
              </label>
              <label className="block text-xs text-muted">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" required className="mt-1 min-h-11 w-full border border-line bg-bg px-3 text-fg" />
              </label>
              <label className="block text-xs text-muted">
                Password
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required={!security.passwordHash} className="mt-1 min-h-11 w-full border border-line bg-bg px-3 text-fg" />
              </label>
              <button type="submit" className="min-h-11 bg-ion px-4 font-display text-bg">
                Save security
              </button>
              <p className="text-xs text-muted">Saving email, phone, and a password reserves 25 T3X once.</p>
            </form>
          )}
          {tab === "accounts" && (
            <div>
              <p className="font-display text-gold">{security.reservedT3x} T3X reserved</p>
              <p className="mt-1 text-sm text-muted">Each linked account reserves 50 T3X from us. More links, more reserved. Sending waits on a verified treasury transfer.</p>
              <ul className="mt-3 space-y-2">
                {PROVIDERS.map((provider) => {
                  const on = security.linked.includes(provider.id);
                  return (
                    <li key={provider.id} className="flex items-center justify-between gap-2 border border-line px-3 py-2">
                      <span className="font-display">{provider.name}</span>
                      <button type="button" disabled={on} onClick={() => onLink(provider.id)} className="min-h-11 bg-ion px-3 font-display text-bg disabled:opacity-50">
                        {on ? "Linked" : `Connect +${provider.reward}`}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {tab === "music" && (
            <div>
              <p className="text-sm text-muted">Low glass score for the horizon. It starts when you turn it on, after a click, so the browser allows sound.</p>
              <button type="button" onClick={() => onMusic(!musicOn)} className="mt-4 min-h-11 bg-ion px-4 font-display text-bg">
                {musicOn ? "Music off" : "Music on"}
              </button>
            </div>
          )}
          {tab === "shop" && (
            <div>
              <p className="font-display text-gold">{profile.marks} glass marks</p>
              <ul className="mt-3 space-y-2">
                {STOCK.map((item) => {
                  const owned = profile.owned.includes(item.id);
                  const on = profile.equipped.includes(item.id);
                  return (
                    <li key={item.id} className="border border-line p-3">
                      <p className="font-display">{item.name}</p>
                      <p className="text-sm text-muted">{item.blurb}</p>
                      {!owned ? (
                        <button type="button" onClick={() => { const result = buyItem(item.id); setProfile(result.profile); setNote(result.ok ? "Fitted." : result.reason ?? ""); }} className="mt-2 min-h-11 bg-ion px-3 font-display text-bg">
                          Buy {item.cost}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setProfile(toggleEquipped(item.id))} className="mt-2 min-h-11 border border-line px-3 font-display">
                          {on ? "Equipped" : "Equip"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {tab === "saves" && (
            <ul className="space-y-2">
              {saves.map((slot, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border border-line p-3">
                  <div>
                    <p className="font-display">Slot {i + 1}</p>
                    <p className="text-xs text-muted">{slot ? new Date(slot.savedAt).toLocaleString() : "Empty"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { const next = onSave(i); setSaves(readSaves()); setNote(next ? `Saved slot ${i + 1}.` : "Deploy first, then save."); }} className="min-h-11 border border-line px-3 font-display">
                      Save
                    </button>
                    <button type="button" disabled={!slot} onClick={() => slot && onLoad(slot)} className="min-h-11 bg-ion px-3 font-display text-bg disabled:opacity-40">
                      Load
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {note && <p className="mt-3 text-sm text-ion">{note}</p>}
        </div>
      </div>
    </div>
  );
}
