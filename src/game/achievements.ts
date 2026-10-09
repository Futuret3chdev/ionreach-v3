import { CHAPTERS } from "./campaign";

export interface Badge {
  id: string;
  name: string;
  detail: string;
}

export interface Downed {
  men: number;
  tanks: number;
  planes: number;
  structures: number;
}

interface Save {
  ids: string[];
  wins: string[];
}

const KEY = "ionreach-achievements-v3";

function read(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ids: [], wins: [] };
    const parsed = JSON.parse(raw) as Save;
    return { ids: parsed.ids ?? [], wins: parsed.wins ?? [] };
  } catch {
    return { ids: [], wins: [] };
  }
}

function write(save: Save): void {
  localStorage.setItem(KEY, JSON.stringify(save));
}

const CATALOG: Badge[] = [
  { id: "first-blood", name: "First contact", detail: "Destroy an enemy soldier." },
  { id: "armor", name: "Armor down", detail: "Destroy an enemy tank." },
  { id: "air", name: "Sky closed", detail: "Destroy an enemy aircraft." },
  { id: "wrecker", name: "Wrecker", detail: "Destroy an enemy structure." },
  { id: "column", name: "Broken column", detail: "Destroy 12 enemies in one fight." },
  { id: "spire", name: "Spire dust", detail: "Win a chapter." },
  { id: "fallen", name: "Horizon lost", detail: "Lose a spire and finish the fight." },
  { id: "three", name: "Three theaters", detail: "Win three different chapters." },
  { id: "all", name: "Full shelf", detail: "Win every filmed chapter." },
];

export function allBadges(): { badge: Badge; owned: boolean }[] {
  const save = read();
  return CATALOG.map((badge) => ({ badge, owned: save.ids.includes(badge.id) }));
}

export function noteCombat(chapterId: string, downed: Downed, finished: "win" | "lose" | null): Badge[] {
  const save = read();
  const have = new Set(save.ids);
  const wins = new Set(save.wins);
  if (finished === "win") wins.add(chapterId);
  const total = downed.men + downed.tanks + downed.planes + downed.structures;
  const want: string[] = [];
  if (downed.men > 0) want.push("first-blood");
  if (downed.tanks > 0) want.push("armor");
  if (downed.planes > 0) want.push("air");
  if (downed.structures > 0) want.push("wrecker");
  if (total >= 12) want.push("column");
  if (finished === "win") want.push("spire");
  if (finished === "lose") want.push("fallen");
  if (wins.size >= 3) want.push("three");
  if (wins.size >= CHAPTERS.filter((c) => c.video).length) want.push("all");
  const fresh = want.filter((id) => !have.has(id));
  for (const id of fresh) have.add(id);
  write({ ids: [...have], wins: [...wins] });
  return CATALOG.filter((b) => fresh.includes(b.id));
}
