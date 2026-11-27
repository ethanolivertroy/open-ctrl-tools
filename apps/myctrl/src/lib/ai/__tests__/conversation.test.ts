import { describe, expect, it } from 'vitest';
import { clipConversationHistory } from '../conversation';

describe('clipConversationHistory', () => {
  it('keeps only the last N non-empty turns', () => {
    expect(clipConversationHistory([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
    ], 2)).toEqual([
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
    ]);

    expect(clipConversationHistory([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: '   ' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ], 12)).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
  });

  it('truncates oversized turn content', () => {
    const [turn] = clipConversationHistory([
      { role: 'assistant', content: 'x'.repeat(25000) },
    ]);
    expect(turn.content).toHaveLength(20000);
  });
});
