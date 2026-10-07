import { eventBus, type FederationEvent } from "@/server/federation/event-bus";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * GET /api/federation/events — Server-Sent Events stream (spec §13, §25).
 * The frontend subscribes here during federated rounds; the orchestrator
 * publishes real training events.
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: FederationEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream closed
        }
      };

      // initial handshake
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "STREAM_CONNECTED", message: "DataVault federation event stream connected", timestamp: new Date().toISOString() })}\n\n`
        )
      );

      // replay recent history so late subscribers see context
      for (const e of eventBus.history.slice(-30)) send(e);

      const unsubscribe = eventBus.subscribe(send);

      // heartbeat to keep intermediaries alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // auto-close after 10 minutes of streaming (client reconnects via EventSource)
      setTimeout(close, 10 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
