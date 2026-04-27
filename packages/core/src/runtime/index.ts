export {
  emitEvent,
  makeEvent,
  findingEvent,
  isCriticalSeverity,
  initStateFile,
  type EngagementEvent,
  type EngagementEventBase,
  type EventSink,
} from './events.js';

export {
  EngagementStateSchema,
  writeEngagementState,
  loadEngagementState,
  newEngagementState,
  type EngagementState,
  type LoadStateResult,
  type LoadStateOk,
  type LoadStateFailure,
} from './state.js';

export {
  installSignalHandlers,
  type DumpReason,
  type SignalHandlerOptions,
} from './signals.js';

export {
  dispatchNotification,
  type NotificationConfig,
} from './notifications.js';

export {
  sha256,
  canonicalize,
  hashCanonical,
} from './hash.js';

export {
  ChainedEmitter,
  verifyAuditChain,
  type ChainedEmitterOpts,
  type ChainVerifyResult,
  type ChainVerifyOk,
  type ChainVerifyFailure,
} from './chain.js';
