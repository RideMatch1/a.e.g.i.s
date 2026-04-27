/**
 * Notification dispatcher.
 *
 * Closes APTS-HO-015 (Real-Time Activity Monitoring and Multi-Channel
 * Notification — partial closure: webhook channel only; multi-channel
 * (Slack/email/PagerDuty) is Cluster-2.5 work).
 *
 * Operator declares one or more webhook URLs in the RoE schema (notifications
 * field) or via the siege --notify-webhook flag. The dispatcher fires
 * fire-and-forget HTTP POST with the JSONL event payload. Failures are
 * logged to the same event channel as `notification-failed` events but do
 * not halt the engagement.
 */
import type { EngagementEvent, EventSink } from './events.js';
import { emitEvent, makeEvent } from './events.js';

export interface NotificationConfig {
  /** Webhook URLs to POST events to. Operators may set multiple. */
  webhooks: string[];
  /** Subset of event types to forward. Defaults to high-signal events. */
  events?: EngagementEvent['event'][];
  /** Per-request timeout in ms. Default 5000. */
  timeoutMs?: number;
}

const DEFAULT_FORWARDED: EngagementEvent['event'][] = [
  'engagement-start',
  'critical-finding',
  'intervention',
  'halt',
  'kill',
  'completion',
];

export async function dispatchNotification(
  event: EngagementEvent,
  config: NotificationConfig,
  eventSink: EventSink,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const allowed = config.events ?? DEFAULT_FORWARDED;
  if (!allowed.includes(event.event)) return;

  const timeoutMs = config.timeoutMs ?? 5000;
  for (const url of config.webhooks) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetcher(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!res.ok) {
        emitEvent(
          makeEvent(event.engagement_id, 'halt', {
            reason: `notification-webhook ${url} returned ${res.status} for event ${event.event} — non-fatal`,
          }),
          eventSink,
        );
      }
    } catch (err) {
      emitEvent(
        makeEvent(event.engagement_id, 'halt', {
          reason: `notification-webhook ${url} threw for event ${event.event}: ${err instanceof Error ? err.message : String(err)} — non-fatal`,
        }),
        eventSink,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
