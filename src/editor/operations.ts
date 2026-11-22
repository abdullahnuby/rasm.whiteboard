export type OperationKind = 'importing' | 'planning' | 'restoring' | 'exporting' | 'saving';
export type OperationState =
  | { readonly phase: 'idle' }
  | { readonly phase: OperationKind; readonly id: number; readonly label: string; readonly progress: number }
  | { readonly phase: 'error'; readonly operation: OperationKind; readonly message: string };

export interface Job {
  readonly id: number;
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  assertCurrent(): void;
  progress(value: number, label?: string): void;
  commit(action: () => void): boolean;
  finish(): void;
  fail(error: unknown): void;
  cancel(): void;
}

/** Owns one foreground operation. Old completions cannot clear or commit over a newer job. */
export class OperationController {
  private nextId = 0;
  private active: { id: number; controller: AbortController; kind: OperationKind } | undefined;
  private current: OperationState = Object.freeze({ phase: 'idle' });
  private listeners = new Set<(state: OperationState) => void>();

  get state(): OperationState { return this.current; }
  subscribe(listener: (state: OperationState) => void): () => void {
    this.listeners.add(listener); listener(this.current);
    return () => this.listeners.delete(listener);
  }
  private publish(state: OperationState): void {
    this.current = Object.freeze(state);
    for (const listener of this.listeners) listener(this.current);
  }
  begin(kind: OperationKind, label: string, valid: () => boolean = () => true): Job {
    this.active?.controller.abort();
    const id = ++this.nextId, controller = new AbortController();
    this.active = { id, controller, kind };
    this.publish({ phase: kind, id, label, progress: 0 });
    const isCurrent = () => this.active?.id === id && !controller.signal.aborted && valid();
    const end = () => {
      if (this.active?.id !== id) return;
      this.active = undefined; this.publish({ phase: 'idle' });
    };
    return {
      id, signal: controller.signal, isCurrent,
      assertCurrent() { if (!isCurrent()) throw new DOMException('Operation superseded or cancelled', 'AbortError'); },
      progress: (value, nextLabel = label) => {
        if (isCurrent()) this.publish({ phase: kind, id, label: nextLabel, progress: Math.max(0, Math.min(1, value)) });
      },
      commit(action) { if (!isCurrent()) return false; action(); return true; },
      finish: end,
      fail: error => {
        if (this.active?.id !== id) return;
        this.active = undefined;
        this.publish({ phase: 'error', operation: kind, message: String(error instanceof Error ? error.message : error) });
      },
      cancel() { controller.abort(); end(); }
    };
  }
  cancel(): void {
    this.active?.controller.abort(); this.active = undefined; this.publish({ phase: 'idle' });
  }
}

/** Per-owner generation guard for work that may complete out of order. */
export class RevisionGate<T extends object> {
  private revisions = new WeakMap<T, number>();
  issue(owner: T): () => boolean {
    const generation = (this.revisions.get(owner) ?? 0) + 1;
    this.revisions.set(owner, generation);
    return () => this.revisions.get(owner) === generation;
  }
  invalidate(owner: T): void { this.revisions.set(owner, (this.revisions.get(owner) ?? 0) + 1); }
}
