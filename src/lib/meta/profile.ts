export type ShopId =
  | "crate"
  | "rig"
  | "plate"
  | "wing"
  | "vault"
  | "squad"
  | "eyes"
  | "kennel"
  | "escort"
  | "scouts"
  | "grid"
  | "drum"
  | "veil"
  | "bomber"
  | "hall"
  | "cadre"
  | "cell"
  | "machine"
  | "siege";

export type ShopItem = {
  id: ShopId;
  name: string;
  cost: number;
  blurb: string;
};

export const STOCK: ShopItem[] = [
  { id: "crate", name: "Ionite crate", cost: 40, blurb: "Deploy with 600 extra ionite." },
  { id: "vault", name: "Ion vault", cost: 80, blurb: "Deploy with 1000 extra ionite." },
  { id: "rig", name: "Spare rig", cost: 70, blurb: "A second harvester starts beside the spire." },
  { id: "plate", name: "Spire plate", cost: 90, blurb: "Command spire deploys with 500 extra hull." },
  { id: "veil", name: "Spire veil", cost: 120, blurb: "Every unit you start with carries a shield." },
  { id: "grid", name: "Spare relay", cost: 75, blurb: "An extra power relay is already on the grid." },
  { id: "drum", name: "Ion drum", cost: 85, blurb: "A silo is already raised. The bank holds more." },
  { id: "hall", name: "Raised barracks", cost: 130, blurb: "Barracks are already up, so you can train at once." },
  { id: "squad", name: "Rifle detail", cost: 55, blurb: "Six extra riflemen on the opening line." },
  { id: "eyes", name: "Watch post", cost: 45, blurb: "Four watches deploy ahead of the column." },
  { id: "kennel", name: "Kennel", cost: 90, blurb: "Three patrolmen and their dogs start with you." },
  { id: "cadre", name: "Sergeant cadre", cost: 160, blurb: "Three sergeants join the first push." },
  { id: "cell", name: "Specops cell", cost: 210, blurb: "Two special forces deploy off the books." },
  { id: "scouts", name: "Viper pair", cost: 95, blurb: "Two light tanks on the flank." },
  { id: "escort", name: "Lancer escort", cost: 100, blurb: "Two line tanks roll with the column." },
  { id: "machine", name: "Machine section", cost: 175, blurb: "A Reaver machine tank is already crewed." },
  { id: "siege", name: "Grenade hull", cost: 200, blurb: "A Howl grenade tank starts on the line." },
  { id: "wing", name: "Reserve wing", cost: 120, blurb: "One extra Kestrel on the opening line." },
  { id: "bomber", name: "Condor reserve", cost: 150, blurb: "A bomber is already in the climb." },
];

export type Profile = {
  marks: number;
  owned: ShopId[];
  equipped: ShopId[];
};

export type SaveSlot = {
  name: string;
  savedAt: number;
  time: number;
  blob: unknown;
};

const PROFILE_KEY = "ionreach.profile";
const SAVES_KEY = "ionreach.saves";

const empty = (): Profile => ({ marks: 0, owned: [], equipped: [] });

export function readProfile(): Profile {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Profile;
    return {
      marks: Number(parsed.marks) || 0,
      owned: Array.isArray(parsed.owned) ? parsed.owned : [],
      equipped: Array.isArray(parsed.equipped) ? parsed.equipped : [],
    };
  } catch {
    return empty();
  }
}

export function writeProfile(profile: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function grantMarks(amount: number): Profile {
  const profile = readProfile();
  profile.marks += amount;
  writeProfile(profile);
  return profile;
}

export function buyItem(id: ShopId): { ok: boolean; profile: Profile; reason?: string } {
  const profile = readProfile();
  const item = STOCK.find((s) => s.id === id);
  if (!item) return { ok: false, profile, reason: "Unknown item." };
  if (profile.owned.includes(id)) return { ok: false, profile, reason: "Already owned." };
  if (profile.marks < item.cost) return { ok: false, profile, reason: "Not enough glass marks." };
  profile.marks -= item.cost;
  profile.owned.push(id);
  profile.equipped.push(id);
  writeProfile(profile);
  return { ok: true, profile };
}

export function toggleEquipped(id: ShopId): Profile {
  const profile = readProfile();
  if (!profile.owned.includes(id)) return profile;
  profile.equipped = profile.equipped.includes(id) ? profile.equipped.filter((x) => x !== id) : [...profile.equipped, id];
  writeProfile(profile);
  return profile;
}

export function readSaves(): (SaveSlot | null)[] {
  const slots: (SaveSlot | null)[] = [null, null, null, null];
  if (typeof localStorage === "undefined") return slots;
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    const parsed = raw ? (JSON.parse(raw) as (SaveSlot | null)[]) : [];
    for (let i = 0; i < 4; i++) slots[i] = parsed[i] ?? null;
  } catch {
    /* keep empty */
  }
  return slots;
}

export function writeSave(index: number, slot: SaveSlot): (SaveSlot | null)[] {
  const slots = readSaves();
  slots[index] = slot;
  localStorage.setItem(SAVES_KEY, JSON.stringify(slots));
  return slots;
}
