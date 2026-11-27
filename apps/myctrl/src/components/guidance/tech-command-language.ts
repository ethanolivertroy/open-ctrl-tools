import type { TechCommandType } from '@/data/types';

/**
 * Single source of truth for how tech-guide command types are syntax
 * highlighted. TechGuidePage, TechGuideSectionPage, and
 * TechGuidePlaybookPage all render the same command data and must agree.
 *
 * `query` commands are Splunk SPL searches in the current datasets and
 * Shiki bundles a Splunk grammar; revisit if query data grows other DSLs.
 * `config` snippets are freeform file contents, so plain text is safest.
 */
export function techCommandLanguage(type: TechCommandType): string {
  switch (type) {
    case 'cli':
    case 'api':
      return 'bash';
    case 'query':
      return 'spl';
    case 'config':
      return 'text';
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}
