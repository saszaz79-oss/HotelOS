/**
 * Domain Event catalog (Architecture §17). Events reserved for features that
 * don't exist yet (PMS integration, Front Office Agent) are typed here so
 * future producers/consumers agree on shape in advance — nothing publishes
 * them until their owning feature ships (see Architecture §26).
 */
export type DomainEventType =
  // v0.1 — real, published by existing modules
  | 'ReportUploaded'
  | 'MetricsExtracted'
  | 'MetricCorrected'
  | 'AlertCreated'
  | 'RecommendationGenerated'
  | 'PDFExported'
  | 'AIConversationStarted'
  // Reserved for v0.2/v0.3 features — declared now, not yet published
  | 'RoomCheckedIn'
  | 'RoomCheckedOut'
  | 'GuestArrived'
  | 'RevenueUpdated';

export interface DomainEvent<Payload = Record<string, unknown>> {
  type: DomainEventType;
  hotelId: string;
  occurredAt: Date;
  payload: Payload;
  /** What triggered this event, e.g. a ReportUpload.id — makes trigger chains traceable (Architecture §17, §20). */
  causationRef?: string;
}
