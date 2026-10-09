export type OpponentMode = "ai" | "players" | "mixed";
export type FormatId = "1v1" | "2v2" | "3v3" | "4v4";
export type MissionKind = "destroy" | "cargo" | "minerals" | "rare" | "steal" | "build" | "nuke" | "relays";

export interface ServerNode {
  id: string;
  name: string;
  region: string;
  note: string;
  open: true;
}

export interface SkirmishMap {
  id: string;
  name: string;
  kind: MissionKind;
  brief: string;
  goal: number;
  clock: number | null;
  chapterId: string;
}

export interface SkirmishSetup {
  serverId: string;
  room: string;
  format: FormatId;
  opponent: OpponentMode;
  mapId: string;
  team: number;
  startMoney: number;
  abilities: boolean;
}

export interface OpenRoom {
  id: string;
  serverId: string;
  room: string;
  format: FormatId;
  opponent: OpponentMode;
  mapId: string;
  seats: number;
  filled: number;
  host: string;
}

export interface ServerStats {
  matches: number;
  kills: number;
  teams: number;
  chapters: number;
}

export const MONEY_MIN = 800;
export const MONEY_MAX = 6000;

export const SERVERS: ServerNode[] = [
  { id: "au-syd", name: "Australia — Sydney", region: "AU", note: "Home theater. Open for all.", open: true },
  { id: "au-mel", name: "Australia — Melbourne", region: "AU", note: "Home theater. Open for all.", open: true },
  { id: "nz-akl", name: "New Zealand — Auckland", region: "NZ", note: "Pacific node. Open for all.", open: true },
  { id: "sg", name: "Singapore", region: "SG", note: "Southeast Asia. Open for all.", open: true },
  { id: "jp-tyo", name: "Japan — Tokyo", region: "JP", note: "East Asia. Open for all.", open: true },
  { id: "kr-sel", name: "Korea — Seoul", region: "KR", note: "East Asia. Open for all.", open: true },
  { id: "in-bom", name: "India — Mumbai", region: "IN", note: "South Asia. Open for all.", open: true },
  { id: "uk-lon", name: "United Kingdom — London", region: "UK", note: "Open for all.", open: true },
  { id: "fr-par", name: "France — Paris", region: "FR", note: "Open for all.", open: true },
  { id: "eu-fra", name: "Europe — Frankfurt", region: "EU", note: "Open for all.", open: true },
  { id: "us-va", name: "United States — Virginia", region: "US", note: "Open for all.", open: true },
  { id: "us-or", name: "United States — Oregon", region: "US", note: "Open for all.", open: true },
  { id: "br-sao", name: "Brazil — São Paulo", region: "BR", note: "Open for all.", open: true },
];

export const FORMATS: FormatId[] = ["1v1", "2v2", "3v3", "4v4"];

export const OPPONENTS: { id: OpponentMode; label: string }[] = [
  { id: "ai", label: "Versus computer" },
  { id: "players", label: "Versus players" },
  { id: "mixed", label: "Players and computer" },
];

export const SKIRMISH_MAPS: SkirmishMap[] = [
  { id: "ash", name: "Ash Meridian", kind: "destroy", brief: "Kill the enemy force. No holdouts, no spire.", goal: 1, clock: null, chapterId: "usa-01" },
  { id: "redline", name: "Redline Convoy", kind: "cargo", brief: "Protect the cargo column until it clears the ridge.", goal: 100, clock: null, chapterId: "australia-01" },
  { id: "basin", name: "Glass Basin", kind: "minerals", brief: "Collect enough ionite before the rival extractors strip the field.", goal: 2800, clock: null, chapterId: "brazil-01" },
  { id: "spire", name: "Veil Spire", kind: "rare", brief: "Only rare prism veins count. Common ore is a distraction.", goal: 1400, clock: null, chapterId: "india-01" },
  { id: "archive", name: "Black Archive", kind: "steal", brief: "Steal the sealed crate from their refinery and bring it home.", goal: 1, clock: null, chapterId: "uk-01" },
  { id: "foundry", name: "Foundry Nine", kind: "build", brief: "Raise the relay spire and hold it through the final cycle.", goal: 1, clock: null, chapterId: "japan-01" },
  { id: "silo", name: "Countdown Silo", kind: "nuke", brief: "Destroy the warhead building before the clock hits zero.", goal: 1, clock: 150, chapterId: "russia-01" },
  { id: "orchard", name: "Night Orchard", kind: "relays", brief: "Capture and hold three relays.", goal: 3, clock: null, chapterId: "france-01" },
];

export function seatsFor(format: FormatId): number {
  return { "1v1": 2, "2v2": 4, "3v3": 6, "4v4": 8 }[format];
}

export function serverById(id: string): ServerNode {
  return SERVERS.find((s) => s.id === id) ?? SERVERS[0];
}

export function mapById(id: string): SkirmishMap {
  return SKIRMISH_MAPS.find((m) => m.id === id) ?? SKIRMISH_MAPS[0];
}

export function teamsFor(format: FormatId): number[] {
  return { "1v1": [1, 2], "2v2": [1, 2], "3v3": [1, 2, 3], "4v4": [1, 2, 3, 4] }[format];
}

const ROOM_KEY = "ionreach-rooms-v3";
const STAT_KEY = "ionreach-server-stats-v3";

function seedRooms(): OpenRoom[] {
  return SERVERS.slice(0, 8).map((server, i) => {
    const format = FORMATS[i % FORMATS.length];
    const map = SKIRMISH_MAPS[i % SKIRMISH_MAPS.length];
    return {
      id: `seed-${server.id}`,
      serverId: server.id,
      room: `${server.region} Open ${format}`,
      format,
      opponent: i % 3 === 0 ? "mixed" : "players",
      mapId: map.id,
      seats: seatsFor(format),
      filled: 1 + (i % (seatsFor(format) - 1)),
      host: "Open table",
    };
  });
}

export function listRooms(): OpenRoom[] {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    const hosted = raw ? (JSON.parse(raw) as OpenRoom[]) : [];
    return [...seedRooms(), ...hosted];
  } catch {
    return seedRooms();
  }
}

export function publishRoom(setup: SkirmishSetup): void {
  const rooms = listRooms().filter((room) => !room.id.startsWith("seed-") && room.room !== setup.room);
  rooms.unshift({
    id: `${setup.serverId}-${setup.room}`,
    serverId: setup.serverId,
    room: setup.room,
    format: setup.format,
    opponent: setup.opponent,
    mapId: setup.mapId,
    seats: seatsFor(setup.format),
    filled: 1,
    host: "You",
  });
  localStorage.setItem(ROOM_KEY, JSON.stringify(rooms.slice(0, 24)));
  bumpServer(setup.serverId, { matches: 1, teams: 1 });
}

export function serverStats(id: string): ServerStats {
  const base = SERVERS.findIndex((s) => s.id === id);
  const seeded = { matches: 40 + base * 17, kills: 820 + base * 260, teams: 18 + base * 4, chapters: 6 + (base % 5) };
  try {
    const raw = localStorage.getItem(STAT_KEY);
    const extra = raw ? (JSON.parse(raw) as Record<string, ServerStats>)[id] : null;
    if (!extra) return seeded;
    return {
      matches: seeded.matches + extra.matches,
      kills: seeded.kills + extra.kills,
      teams: seeded.teams + extra.teams,
      chapters: seeded.chapters + extra.chapters,
    };
  } catch {
    return seeded;
  }
}

export function bumpServer(id: string, add: Partial<ServerStats>): void {
  try {
    const raw = localStorage.getItem(STAT_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, ServerStats>) : {};
    const cur = all[id] ?? { matches: 0, kills: 0, teams: 0, chapters: 0 };
    all[id] = {
      matches: cur.matches + (add.matches ?? 0),
      kills: cur.kills + (add.kills ?? 0),
      teams: cur.teams + (add.teams ?? 0),
      chapters: cur.chapters + (add.chapters ?? 0),
    };
    localStorage.setItem(STAT_KEY, JSON.stringify(all));
  } catch {
    /* local only */
  }
}

export const EXPANSIONS = [
  { id: "free-core", name: "Core theaters", price: "Free", detail: "The ten country chains and the Australian fronts.", owned: true },
  { id: "pacific", name: "Pacific expansion", price: "Later", detail: "New Zealand and island maps. Listed now, not for sale yet.", owned: false },
  { id: "commanders", name: "Commander pack", price: "Later", detail: "Extra special abilities. Listed now, not for sale yet.", owned: false },
];
