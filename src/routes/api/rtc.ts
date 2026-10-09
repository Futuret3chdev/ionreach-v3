import { createFileRoute } from "@tanstack/react-router";
import { leaveRoom, pollRoom, postSignal } from "@/lib/multiplayer/relay";

export const Route = createFileRoute("/api/rtc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const room = url.searchParams.get("room") ?? "";
        const peer = url.searchParams.get("peer") ?? "";
        const name = url.searchParams.get("name") ?? "";
        const since = Number(url.searchParams.get("since") ?? "0");
        if (!room || !peer) return Response.json({ error: "room and peer required" }, { status: 400 });
        return Response.json(pollRoom(room, peer, name, since));
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          op?: string;
          room?: string;
          peer?: string;
          from?: string;
          to?: string;
          kind?: "offer" | "answer" | "ice";
          payload?: unknown;
        };
        if (!body.room) return Response.json({ error: "room required" }, { status: 400 });
        if (body.op === "leave") return Response.json(leaveRoom(body.room, body.peer ?? ""));
        if (body.op === "signal" && body.from && body.to && body.kind) {
          return Response.json(postSignal(body.room, body.from, body.to, body.kind, body.payload));
        }
        return Response.json({ error: "unknown op" }, { status: 400 });
      },
    },
  },
});
