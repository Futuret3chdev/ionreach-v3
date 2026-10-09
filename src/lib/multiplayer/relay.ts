type Peer = { id: string; name: string; seen: number };
type Signal = { id: number; from: string; to: string; kind: "offer" | "answer" | "ice"; payload: unknown };
type Room = { peers: Map<string, Peer>; signals: Signal[]; next: number };

const g = globalThis as typeof globalThis & { __ionreachRooms?: Map<string, Room> };
const rooms = g.__ionreachRooms ?? new Map<string, Room>();
g.__ionreachRooms = rooms;

const STALE_MS = 20000;

function roomOf(code: string): Room {
  const key = code.trim().toLowerCase();
  let room = rooms.get(key);
  if (!room) {
    room = { peers: new Map(), signals: [], next: 1 };
    rooms.set(key, room);
  }
  return room;
}

function sweep(room: Room): void {
  const now = Date.now();
  for (const [id, peer] of room.peers) {
    if (now - peer.seen > STALE_MS) room.peers.delete(id);
  }
  if (room.signals.length > 400) room.signals.splice(0, room.signals.length - 200);
}

export function pollRoom(code: string, peer: string, name: string, since: number) {
  const room = roomOf(code);
  sweep(room);
  room.peers.set(peer, { id: peer, name: name || "Callsign", seen: Date.now() });
  return {
    peers: [...room.peers.values()].map((p) => ({ id: p.id, name: p.name })),
    signals: room.signals.filter((s) => s.id > since && s.to === peer),
  };
}

export function postSignal(code: string, from: string, to: string, kind: Signal["kind"], payload: unknown) {
  const room = roomOf(code);
  const id = room.next++;
  room.signals.push({ id, from, to, kind, payload });
  return { ok: true, id };
}

export function leaveRoom(code: string, peer: string) {
  rooms.get(code.trim().toLowerCase())?.peers.delete(peer);
  return { ok: true };
}
