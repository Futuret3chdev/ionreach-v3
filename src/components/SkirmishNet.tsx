import { useState } from "react";
import { CHAPTERS } from "@/game/campaign";
import { EXPANSIONS, FORMATS, MONEY_MAX, MONEY_MIN, OPPONENTS, SERVERS, SKIRMISH_MAPS, listRooms, mapById, publishRoom, serverStats, teamsFor, type FormatId, type OpenRoom, type OpponentMode, type SkirmishSetup } from "@/game/skirmish";

export function SkirmishNet({ onClose, onHost }: { onClose: () => void; onHost: (setup: SkirmishSetup) => void }) {
  const [serverId, setServerId] = useState(SERVERS[0].id);
  const [format, setFormat] = useState<FormatId>("2v2");
  const [opponent, setOpponent] = useState<OpponentMode>("mixed");
  const [mapId, setMapId] = useState(SKIRMISH_MAPS[0].id);
  const [room, setRoom] = useState("Open Veil");
  const [team, setTeam] = useState(1);
  const [startMoney, setStartMoney] = useState(2100);
  const [abilities, setAbilities] = useState(true);
  const [tab, setTab] = useState<"servers" | "shop">("servers");
  const [rooms, setRooms] = useState<OpenRoom[]>(() => listRooms());
  const listed = rooms.filter((item) => item.serverId === serverId);
  const stats = serverStats(serverId);
  const played = CHAPTERS.filter((c) => c.countryId === "australia").length;

  function enter(setup: SkirmishSetup, hosting: boolean) {
    if (hosting) {
      publishRoom(setup);
      setRooms(listRooms());
    }
    onHost(setup);
  }

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-bg/94 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-4xl">Multiplayer servers</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTab("servers")} className={tab === "servers" ? "min-h-11 border border-ion px-3 font-display text-ion" : "min-h-11 border border-line px-3 font-display"}>Servers</button>
            <button type="button" onClick={() => setTab("shop")} className={tab === "shop" ? "min-h-11 border border-ion px-3 font-display text-ion" : "min-h-11 border border-line px-3 font-display"}>Shop</button>
            <button type="button" onClick={onClose} className="min-h-11 border border-line px-3 font-display">Back to menu</button>
          </div>
        </div>
        {tab === "shop" ? (
          <div className="mt-4 grid gap-3">
            {EXPANSIONS.map((item) => (
              <article key={item.id} className="border border-line bg-surface p-4">
                <p className="font-display text-2xl">{item.name}</p>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
                <p className="mt-2 font-display text-ion">{item.owned ? "Owned · free" : "Purchase later"}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="border border-line bg-surface p-4">
              <p className="font-display text-xs tracking-[0.22em] text-ion">OPEN FOR ALL</p>
              <div className="mt-3 grid gap-2">
                {SERVERS.map((server) => {
                  const row = serverStats(server.id);
                  return (
                    <button key={server.id} type="button" onClick={() => setServerId(server.id)} className={server.id === serverId ? "border border-ion bg-bg p-3 text-left" : "border border-line bg-bg p-3 text-left"}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-display text-xl">{server.name}</span>
                        <span className="font-display text-xs tracking-[0.14em] text-ion">OPEN</span>
                      </span>
                      <span className="mt-1 block text-sm text-muted">{row.matches} matches · {row.kills} kills · {row.teams} teams · {row.chapters} chapters</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="border border-line bg-surface p-4">
              <p className="font-display text-xs tracking-[0.22em] text-gold">{stats.matches} MATCHES ON THIS NODE</p>
              <h3 className="font-display text-3xl">Games you can join</h3>
              <div className="mt-3 grid gap-2">
                {listed.length === 0 && <p className="text-sm text-muted">No open game on this server yet. Host one and it stays listed.</p>}
                {listed.map((item) => (
                  <article key={item.id} className="border border-line bg-bg p-3">
                    <p className="font-display text-xl">{item.room}</p>
                    <p className="text-sm text-muted">{item.format} · {item.opponent === "ai" ? "Computer" : item.opponent === "mixed" ? "Players and computer" : "Players"} · {mapById(item.mapId).name} · {item.filled}/{item.seats} seats</p>
                    <button type="button" onClick={() => enter({ serverId: item.serverId, room: item.room, format: item.format, opponent: item.opponent, mapId: item.mapId, team, startMoney, abilities }, false)} className="mt-2 min-h-11 bg-ion px-3 font-display text-bg">Join this game</button>
                  </article>
                ))}
              </div>
              <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">YOUR SIDE</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {teamsFor(format).map((n) => (
                  <button key={n} type="button" onClick={() => setTeam(n)} className={team === n ? "min-h-11 border border-ion px-3 font-display text-ion" : "min-h-11 border border-line px-3 font-display"}>Team {n}</button>
                ))}
              </div>
              <p className="mt-1 text-sm text-muted">Same team number is an ally. 1v1 is two sides. 4v4 opens four teams.</p>
              <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">FORMAT</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FORMATS.map((item) => (
                  <button key={item} type="button" onClick={() => { setFormat(item); setTeam(1); }} className={format === item ? "min-h-11 border border-ion px-3 font-display text-ion" : "min-h-11 border border-line px-3 font-display"}>{item}</button>
                ))}
              </div>
              <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">WHO IS IN THE FIGHT</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {OPPONENTS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setOpponent(item.id)} className={opponent === item.id ? "min-h-11 border border-ion px-3 font-display text-ion" : "min-h-11 border border-line px-3 font-display"}>{item.label}</button>
                ))}
              </div>
              <label className="mt-4 block font-display text-xs tracking-[0.16em] text-muted">START MONEY · MAX {MONEY_MAX}</label>
              <input type="range" min={MONEY_MIN} max={MONEY_MAX} step={100} value={startMoney} onChange={(e) => setStartMoney(Number(e.target.value))} className="mt-2 w-full" />
              <p className="text-sm text-muted">{startMoney} ionite. The cap is {MONEY_MAX}.</p>
              <button type="button" onClick={() => setAbilities((v) => !v)} className="mt-3 min-h-11 border border-line px-3 font-display">{abilities ? "Special abilities on" : "Special abilities off"}</button>
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
              <p className="mt-2 text-sm text-muted">{played} Australian chapters on this build. Your hosted room stays on this server list.</p>
              <button type="button" onClick={() => enter({ serverId, room, format, opponent, mapId, team, startMoney, abilities }, true)} className="mt-4 min-h-11 bg-ion px-4 font-display text-bg">Host and enter</button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
