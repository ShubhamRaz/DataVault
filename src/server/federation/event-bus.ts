/**
 * DataVault — In-process event bus for real-time federation events (spec §13, §25).
 * SSE endpoints subscribe; the orchestrator publishes. The underlying state
 * always comes from actual backend training events (spec §65).
 */

export interface FederationEvent {
  type:
    | "ROUND_STARTED"
    | "MODEL_DISTRIBUTED"
    | "PARTICIPANT_TRAINING"
    | "LOCAL_UPDATE_GENERATED"
    | "UPDATE_ENCRYPTED"
    | "UPDATE_SUBMITTED"
    | "SECURE_AGGREGATION"
    | "GLOBAL_MODEL_UPDATED"
    | "REWARD_CALCULATED"
    | "BLOCKCHAIN_RECORDED"
    | "ROUND_COMPLETED"
    | "ROUND_FAILED"
    | "TRAINING_PROGRESS";
  roundId: string;
  roundNumber: number;
  modelId: string;
  modelName: string;
  participantId?: string;
  participantName?: string;
  progress?: number;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

type Subscriber = (e: FederationEvent) => void;

const g = globalThis as unknown as { __dvEventBus?: EventBus };

export class EventBus {
  private subscribers = new Set<Subscriber>();
  history: FederationEvent[] = [];

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  publish(event: FederationEvent) {
    this.history.push(event);
    if (this.history.length > 500) this.history.splice(0, this.history.length - 500);
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {
        // subscriber errors never break the orchestrator
      }
    }
  }
}

export const eventBus = g.__dvEventBus ?? new EventBus();
g.__dvEventBus = eventBus;
