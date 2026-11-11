// The assistant port, answered by the `omnibar` Edge Function. Never logs message text.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError, type SupabaseClient } from '@supabase/supabase-js';

import type { Assistant, AssistantReply } from '../../contracts/assistant';
import { logFault } from '../../diag/faultStore';

const COULD_NOT = 'The assistant could not answer. Try again.';

export function supabaseAssistant(client: SupabaseClient): Assistant {
  return {
    async ask(request): Promise<AssistantReply> {
      try {
        const { data, error } = await client.functions.invoke('omnibar', { body: request });
        if (error) {
          if (error instanceof FunctionsHttpError) {
            let message = COULD_NOT;
            try {
              const body = await error.context.json();
              if (body?.error) message = String(body.error);
            } catch {
              // keep the plain message
            }
            logFault('omnibar', new Error(`HTTP ${error.context.status}: ${message}`));
            return { kind: 'error', message };
          }
          if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) return { kind: 'offline' };
          logFault('omnibar', error);
          return { kind: 'error', message: COULD_NOT };
        }
        return {
          kind: 'answer',
          reply: String(data?.reply ?? ''),
          actions: Array.isArray(data?.actions) ? data.actions : [],
          backup: data?.engine === 'backup',
        };
      } catch (e) {
        logFault('omnibar', e);
        return { kind: 'offline' };
      }
    },
  };
}
