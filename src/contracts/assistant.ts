// The assistant port: Send in the one box asks it (the omnibar Edge Function in the app).
// The AI's actions are untrusted, so they stay `unknown` here; the app checks every id before use.

export type AssistantTurn = { role: 'user' | 'assistant'; text: string };

/** The case the nurse is working on, so "his card" or "the closure" mean its card. */
export type AssistantCase = { surgeon: string | null; procedure: string | null; card_id: string | null };

/** The message is already scrubbed on the phone. No `case` field when the case is unknown. */
export type AssistantRequest = { message: string; history: AssistantTurn[]; department_id: string; case?: AssistantCase };

export type AssistantReply =
  /** backup = the free backup AI answered instead of Claude. */
  | { kind: 'answer'; reply: string; actions: unknown[]; backup: boolean }
  /** The server answered with a problem, in words a nurse can read. */
  | { kind: 'error'; message: string }
  /** The assistant could not be reached. */
  | { kind: 'offline' };

export interface Assistant {
  ask(request: AssistantRequest): Promise<AssistantReply>;
}
