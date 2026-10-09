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
}

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
