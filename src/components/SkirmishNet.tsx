import { useState } from "react";
import { FORMATS, OPPONENTS, SERVERS, SKIRMISH_MAPS, seatsFor, type FormatId, type OpponentMode, type SkirmishSetup } from "@/game/skirmish";

export function SkirmishNet({ onClose, onHost }: { onClose: () => void; onHost: (setup: SkirmishSetup) => void }) {
  const [serverId, setServerId] = useState(SERVERS[0].id);
  const [format, setFormat] = useState<FormatId>("1v1");
  const [opponent, setOpponent] = useState<OpponentMode>("ai");
  const [mapId, setMapId] = useState(SKIRMISH_MAPS[0].id);
  const [room, setRoom] = useState("Open Veil");
  const [joinCode, setJoinCode] = useState("");

  function host(code = room) {
    onHost({ serverId, room: code.trim() || serverId, format, opponent, mapId });
  }

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-bg/94 p-4 md:p-8">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <section className="border border-line bg-surface p-4">
          <p className="font-display text-xs tracking-[0.22em] text-ion">OPEN FOR ALL</p>
          <h2 className="font-display text-4xl">Country servers</h2>
          <p className="mt-2 text-sm text-muted">Australia is the home theater. Every node below stays listed and open. Empty seats are filled by the computer unless another commander joins.</p>
          <div className="mt-4 grid gap-2">
            {SERVERS.map((server) => (
              <button key={server.id} type="button" onClick={() => setServerId(server.id)} className={server.id === serverId ? "border border-ion bg-bg p-3 text-left" : "border border-line bg-bg p-3 text-left"}>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-xl">{server.name}</span>
                  <span className="font-display text-xs tracking-[0.14em] text-ion">OPEN</span>
                </span>
                <span className="mt-1 block text-sm text-muted">{server.note}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="border border-line bg-surface p-4">
          <p className="font-display text-xs tracking-[0.22em] text-gold">SKIRMISH</p>
          <h2 className="font-display text-4xl">Host a room</h2>
          <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">WHO IS IN THE FIGHT</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {OPPONENTS.map((item) => (
              <button key={item.id} type="button" onClick={() => setOpponent(item.id)} className={opponent === item.id ? "min-h-11 border border-ion px-3 font-display text-ion" : "min-h-11 border border-line px-3 font-display"}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">FORMAT</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {FORMATS.map((item) => (
              <button key={item} type="button" onClick={() => setFormat(item)} className={format === item ? "min-h-11 border border-ion px-3 font-display text-ion" : "min-h-11 border border-line px-3 font-display"}>
                {item}
              </button>
            ))}
          </div>
          <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">OBJECTIVE MAP</label>
          <div className="mt-2 grid gap-2">
            {SKIRMISH_MAPS.map((map) => (
              <button key={map.id} type="button" onClick={() => setMapId(map.id)} className={mapId === map.id ? "border border-ion bg-bg p-3 text-left" : "border border-line bg-bg p-3 text-left"}>
                <span className="font-display text-lg">{map.name}</span>
                <span className="mt-1 block text-sm text-muted">{map.brief}</span>
              </button>
            ))}
          </div>
          <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">ROOM NAME</label>
          <input value={room} onChange={(e) => setRoom(e.target.value)} className="mt-2 w-full border border-line bg-bg px-3 py-2" />
          <p className="mt-2 text-sm text-muted">{seatsFor(format)} seats on {SERVERS.find((s) => s.id === serverId)?.name}. Join code is the room name.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => host()} className="min-h-11 bg-ion px-4 font-display text-bg">Host and enter</button>
            <button type="button" onClick={onClose} className="min-h-11 border border-line px-4 font-display">Go back</button>
          </div>
          <label className="mt-5 block font-display text-xs tracking-[0.16em] text-muted">JOIN AN OPEN ROOM</label>
          <div className="mt-2 flex gap-2">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Room name" className="min-w-0 flex-1 border border-line bg-bg px-3 py-2" />
            <button type="button" onClick={() => host(joinCode || serverId)} className="min-h-11 border border-line px-3 font-display">Join</button>
          </div>
        </section>
      </div>
    </div>
  );
}
