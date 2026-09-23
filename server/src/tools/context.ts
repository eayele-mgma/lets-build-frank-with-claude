/** What every tool may know about the Frank that is running it. */
export interface ToolContext {
  version: string;
  /** Epoch milliseconds when this process started. */
  startedAt: number;
  /** Injectable clock, so tests do not depend on real time. */
  now: () => number;
}
