import { describe, expect, it } from 'vitest';
import { parseStructuredViewResponse, validateStructuredView } from '@/lib/ai/structured-view';

describe('structured view parsing', () => {
  it('validates a parsed structured view', () => {
    const result = validateStructuredView({
      title: 'Example',
      components: [
        {
          type: 'TextBlock',
          content: 'Hello world',
          variant: 'default',
        },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.view?.title).toBe('Example');
  });

  it('formats validation failures with a useful path', () => {
    const result = validateStructuredView({
      title: 'Broken',
      components: [
        {
          type: 'ControlCard',
          frameworkId: 'nist-800-53-r5',
        },
      ],
    });

    expect(result.view).toBeNull();
    expect(result.error).toContain('components.0.controlId');
  });

  it('parses streamed AI text into a validated view', () => {
    const result = parseStructuredViewResponse(`0:"{\\"title\\":\\"Example\\",\\"components\\":[{\\"type\\":\\"TextBlock\\",\\"content\\":\\"Hi\\",\\"variant\\":\\"default\\"}]}"`);

    expect(result.error).toBeNull();
    expect(result.view?.components).toHaveLength(1);
  });

  it('defaults a missing TextBlock variant', () => {
    const result = validateStructuredView({
      title: 'Example',
      components: [
        {
          type: 'TextBlock',
          content: 'Hello without variant',
        },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.view?.components[0]).toMatchObject({
      type: 'TextBlock',
      variant: 'default',
    });
  });

  it('coerces unknown component types into TextBlock', () => {
    const result = validateStructuredView({
      title: 'Example',
      components: [
        {
          type: 'ActionButtons',
          actions: [{ label: 'Open', href: '/frameworks/nist-800-53-r5/ac-2' }],
        },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.view?.components[0]?.type).toBe('TextBlock');
  });
});
