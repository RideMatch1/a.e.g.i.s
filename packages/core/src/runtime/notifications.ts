/**
 * Notification dispatcher — multi-channel.
 *
 * Closes APTS-HO-015 (Real-Time Activity Monitoring and Multi-Channel
 * Notification). v0.18.0 F-NOTIFY-CHANNELS-1 added Slack + Discord adapters
 * alongside the original generic webhook channel; PagerDuty + Email remain
 * future additions.
 *
 * Operator declares channels per type in the RoE schema (notifications
 * field) or via siege CLI flags (--notify-webhook / --notify-slack /
 * --notify-discord, all repeatable). The dispatcher fires fire-and-forget
 * HTTP POST per channel with the channel-specific payload shape. Failures
 * are logged as halt-events with a channel-tagged reason but do not halt
 * the engagement.
 */
import type { EngagementEvent, EventSink } from './events.js';
import { emitEvent, makeEvent } from './events.js';

export interface NotificationConfig {
  /** Generic webhook URLs (raw EngagementEvent JSON). Repeatable. */
  webhooks?: string[];
  /** Slack incoming-webhook URLs (Slack Block-Kit shape). Repeatable. */
  slack?: string[];
  /** Discord webhook URLs (Discord embed shape). Repeatable. */
  discord?: string[];
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

// Discord embed colors per event type (decimal RGB).
const DISCORD_COLORS: Partial<Record<EngagementEvent['event'], number>> = {
  'engagement-start': 3447003,    // blue
  'critical-finding': 16711680,   // red
  intervention: 15105570,         // orange
  halt: 16711680,                 // red
  kill: 0,                        // black
  completion: 5763719,            // green
};

function formatForSlack(event: EngagementEvent): unknown {
  const summary = `🛡 AEGIS \`${event.event}\` — engagement \`${event.engagement_id}\``;
  // Truncate JSON to fit Slack block-kit text limits (~3000 chars per section)
  const payloadJson = JSON.stringify(event, null, 2).slice(0, 1500);
  return {
    text: summary,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `AEGIS — ${event.event}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*engagement:* \`${event.engagement_id}\`\n*ts:* ${event.ts}` } },
      { type: 'section', text: { type: 'mrkdwn', text: '```' + payloadJson + '```' } },
    ],
  };
}

function formatForDiscord(event: EngagementEvent): unknown {
  const color = DISCORD_COLORS[event.event] ?? 8421504; // default: gray
  // Discord embed-field value limit is 1024 chars
  const payloadJson = JSON.stringify(event, null, 2).slice(0, 900);
  return {
    content: `**AEGIS** — \`${event.event}\``,
    embeds: [{
      title: event.event,
      description: `engagement: \`${event.engagement_id}\``,
      color,
      timestamp: event.ts,
      fields: [{ name: 'payload', value: '```json\n' + payloadJson + '\n```' }],
    }],
  };
}

interface NotificationTarget {
  url: string;
  body: unknown;
  channel: 'webhook' | 'slack' | 'discord';
}

function buildTargets(event: EngagementEvent, config: NotificationConfig): NotificationTarget[] {
  const targets: NotificationTarget[] = [];
  for (const url of config.webhooks ?? []) {
    targets.push({ url, body: event, channel: 'webhook' });
  }
  for (const url of config.slack ?? []) {
    targets.push({ url, body: formatForSlack(event), channel: 'slack' });
  }
  for (const url of config.discord ?? []) {
    targets.push({ url, body: formatForDiscord(event), channel: 'discord' });
  }
  return targets;
}

export async function dispatchNotification(
  event: EngagementEvent,
  config: NotificationConfig,
  eventSink: EventSink,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const allowed = config.events ?? DEFAULT_FORWARDED;
  if (!allowed.includes(event.event)) return;

  const targets = buildTargets(event, config);
  if (targets.length === 0) return;

  const timeoutMs = config.timeoutMs ?? 5000;
  for (const target of targets) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetcher(target.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(target.body),
        signal: controller.signal,
      });
      if (!res.ok) {
        emitEvent(
          makeEvent(event.engagement_id, 'halt', {
            reason: `notification-${target.channel} ${target.url} returned ${res.status} for event ${event.event} — non-fatal`,
          }),
          eventSink,
        );
      }
    } catch (err) {
      emitEvent(
        makeEvent(event.engagement_id, 'halt', {
          reason: `notification-${target.channel} ${target.url} threw for event ${event.event}: ${err instanceof Error ? err.message : String(err)} — non-fatal`,
        }),
        eventSink,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
