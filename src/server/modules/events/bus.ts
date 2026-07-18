import type { DomainEvent, DomainEventType } from './types';

type Handler<T = Record<string, unknown>> = (event: DomainEvent<T>) => void | Promise<void>;

/**
 * In-process domain event bus (Architecture §17).
 *
 * v0.1 delivery semantics: synchronous, in-process, best-effort. A subscriber
 * failing does not roll back the publisher — the source-of-truth write
 * already happened before publish. This is the mechanism that lets
 * `report-extraction` trigger `insights` recomputation without importing it
 * directly; moving to durable/at-least-once delivery (Roadmap v0.2) changes
 * the transport inside this module, not every call site.
 */
const handlers = new Map<DomainEventType, Handler[]>();

export function subscribe<T = Record<string, unknown>>(
  type: DomainEventType,
  handler: Handler<T>
): void {
  const list = handlers.get(type) ?? [];
  list.push(handler as Handler);
  handlers.set(type, list);
}

export async function publish<T = Record<string, unknown>>(
  event: Omit<DomainEvent<T>, 'occurredAt'> & { occurredAt?: Date }
): Promise<void> {
  const full: DomainEvent<T> = { ...event, occurredAt: event.occurredAt ?? new Date() };
  const list = handlers.get(full.type) ?? [];

  for (const handler of list) {
    try {
      await handler(full as DomainEvent<Record<string, unknown>>);
    } catch (err) {
      // A subscriber failure must never break the publisher's flow
      // (Architecture §17) — logged, not thrown.
      console.error(`[event-bus] handler for ${full.type} failed`, err);
    }
  }
}
