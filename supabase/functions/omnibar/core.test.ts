import { describe, expect, it } from '@jest/globals';

import { groqBody } from './core';
import { SYSTEM_PROMPT } from './prompt';

const base = { context: 'LIBRARY', history: [], message: 'closure?' };

describe('the case line in the AI request', () => {
  it('is unchanged without a case', () => {
    expect(groqBody('m', base).messages[0].content).toBe(`${SYSTEM_PROMPT}\n\nLIBRARY`);
    expect(groqBody('m', { ...base, caseNote: '' }).messages[0].content).toBe(`${SYSTEM_PROMPT}\n\nLIBRARY`);
  });

  it('comes after the library when there is a case', () => {
    expect(groqBody('m', { ...base, caseNote: 'CASE' }).messages[0].content).toBe(`${SYSTEM_PROMPT}\n\nLIBRARY\n\nCASE`);
  });
});
