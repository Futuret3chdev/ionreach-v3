export type ProviderId = "meta" | "google" | "microsoft" | "amazon" | "apple" | "samsung" | "xai";

export const PROVIDERS: { id: ProviderId; name: string; reward: number }[] = [
  { id: "meta", name: "Meta", reward: 50 },
  { id: "google", name: "Google", reward: 50 },
  { id: "microsoft", name: "Microsoft", reward: 50 },
  { id: "amazon", name: "Amazon", reward: 50 },
  { id: "apple", name: "Apple", reward: 50 },
  { id: "samsung", name: "Samsung", reward: 50 },
  { id: "xai", name: "xAI", reward: 50 },
];

export type SecurityProfile = {
  email: string;
  phone: string;
  passwordHash: string;
  linked: ProviderId[];
  reservedT3x: number;
};

const KEY = "ionreach.security";

const empty = (): SecurityProfile => ({ email: "", phone: "", passwordHash: "", linked: [], reservedT3x: 0 });

export function readSecurity(): SecurityProfile {
  if (typeof localStorage === "undefined") return empty();
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "") as SecurityProfile;
    return { ...empty(), ...parsed, linked: parsed.linked ?? [] };
  } catch {
    return empty();
  }
}

function write(profile: SecurityProfile): SecurityProfile {
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveSecurity(input: { email: string; phone: string; password: string }): Promise<SecurityProfile> {
  const current = readSecurity();
  const hadCore = Boolean(current.email && current.phone && current.passwordHash);
  const next: SecurityProfile = {
    ...current,
    email: input.email.trim(),
    phone: input.phone.trim(),
    passwordHash: input.password ? await hashPassword(input.password) : current.passwordHash,
  };
  const hasCore = Boolean(next.email && next.phone && next.passwordHash);
  if (!hadCore && hasCore) next.reservedT3x += 25;
  return write(next);
}

export function linkProvider(id: ProviderId): SecurityProfile {
  const current = readSecurity();
  if (current.linked.includes(id)) return current;
  const reward = PROVIDERS.find((p) => p.id === id)?.reward ?? 0;
  current.linked.push(id);
  current.reservedT3x += reward;
  return write(current);
}
