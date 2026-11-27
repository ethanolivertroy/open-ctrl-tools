import type { View } from '@/lib/json-render/catalog';

export function wrapTextInView(text: string): View {
  return {
    title: 'AI Response',
    components: [
      {
        type: 'TextBlock',
        content: text || 'No response generated.',
        variant: 'default',
      },
    ],
  };
}
