export type TaskState = 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked';

export interface BaseEvent {
  schema_version: '1.0';
  timestamp: string;
}

export interface PlanGeneratedEvent extends BaseEvent {
  type: 'plan_generated';
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: TaskState;
    priority: 'low' | 'medium' | 'high';
    dependencies: string[];
    subtasks: Array<{
      id: string;
      title: string;
      description: string;
      status: TaskState;
      priority: 'low' | 'medium' | 'high';
      tools?: string[];
    }>;
  }>;
}

export interface TaskUpdateEvent extends BaseEvent {
  type: 'task_update';
  id: string;
  status: TaskState;
  error?: {
    code: string;
    message: string;
  };
}

export interface FinalMessageEvent extends BaseEvent {
  type: 'final_message';
  text: string;
  actionPlan?: any;
}

export interface ErrorMessageEvent extends BaseEvent {
  type: 'error_message';
  error: {
    code: string;
    message: string;
  };
}

export interface ModeSelectedEvent extends BaseEvent {
  type: 'mode_selected';
  mode: 'chat' | 'deep_search' | 'automate';
  source: 'user' | 'classifier';
  confidence: number;
}

export type AgentSSEEvent = 
  | PlanGeneratedEvent 
  | TaskUpdateEvent 
  | FinalMessageEvent 
  | ErrorMessageEvent
  | ModeSelectedEvent;

/**
 * Handles strict SSE compliance and sequential serialized stream writing.
 * Prevents race conditions and chunk corruption by chaining writes in a Promise sequence.
 */
export class EventStreamDispatcher {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder = new TextEncoder();
  private lastWrite = Promise.resolve();

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer;
  }

  /**
   * Serializes the SSE wire format event frame and queues its dispatch safely.
   */
  public send(event: AgentSSEEvent): Promise<void> {
    this.lastWrite = this.lastWrite.then(async () => {
      try {
        await this.writer.ready;
        const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        await this.writer.write(this.encoder.encode(frame));
      } catch (err) {
        console.error('[EventStreamDispatcher Error writing frame]:', err);
      }
    });
    return this.lastWrite;
  }
}
