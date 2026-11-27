import * as React from 'react';
import { CommandBlock } from '@/components/ui/CommandBlock';

interface Props {
  content: string;
  type: 'check' | 'remediation';
}

interface Segment {
  type: 'text' | 'command';
  content: string;
}

/**
 * Parse STIG check/fix content and extract commands into separate segments
 */
function parseSTIGContent(text: string): Segment[] {
  const segments: Segment[] = [];

  // Patterns that introduce commands
  const commandIntros = [
    /[Rr]un the command:\s*/g,
    /[Ee]xecute the commands?:\s*/g,
    /using the following command:\s*/g,
  ];

  // Patterns that end commands
  const commandEnds = [
    /\s+If\s+/,
    /\s+Note\s+/,
    /\s+The\s+/,
    /\s+Remove\s+/,
    /\s+Edit\s+/,
    /\s+Set\s+"/,
    /\s+Restart\s+/,
    /\s+For\s+the\s+/,
    /\s+Verify\s+/,
  ];

  // Build a combined pattern to find all command introductions
  let workingText = text;
  let lastIndex = 0;

  // Find all positions where commands start
  const commandStarts: { index: number; matchLength: number; pattern: RegExp }[] = [];

  for (const pattern of commandIntros) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      commandStarts.push({
        index: match.index,
        matchLength: match[0].length,
        pattern,
      });
    }
  }

  // Sort by position
  commandStarts.sort((a, b) => a.index - b.index);

  if (commandStarts.length === 0) {
    // No commands found, return as single text segment
    return [{ type: 'text', content: text }];
  }

  // Process each command
  for (let i = 0; i < commandStarts.length; i++) {
    const start = commandStarts[i];
    const commandStartPos = start.index + start.matchLength;

    // Add text before this command intro
    if (start.index > lastIndex) {
      const textBefore = text.slice(lastIndex, start.index).trim();
      if (textBefore) {
        segments.push({ type: 'text', content: textBefore });
      }
    }

    // Find where command ends
    const nextCommandStart = commandStarts[i + 1]?.index || text.length;
    const textAfterCommand = text.slice(commandStartPos, nextCommandStart);

    // Find first ending pattern
    let commandEndPos = textAfterCommand.length;
    for (const endPattern of commandEnds) {
      const match = textAfterCommand.match(endPattern);
      if (match && match.index !== undefined && match.index < commandEndPos) {
        commandEndPos = match.index;
      }
    }

    // Extract command
    let commandText = textAfterCommand.slice(0, commandEndPos).trim();

    // Split multi-commands (for "execute the commands:" pattern)
    // Look for kubectl/grep/ps patterns that start a new command
    const multiCommandPattern = /\s+(kubectl|grep|ps|cat|ls|chmod|chown|systemctl)\s+/g;
    const commandParts: string[] = [];

    // Check if this looks like multiple commands
    if (start.pattern.source.includes('commands')) {
      // This is "execute the commands:" - split on command boundaries
      let cmdLastIndex = 0;
      multiCommandPattern.lastIndex = 0;
      let cmdMatch;

      while ((cmdMatch = multiCommandPattern.exec(commandText)) !== null) {
        if (cmdMatch.index > cmdLastIndex) {
          const part = commandText.slice(cmdLastIndex, cmdMatch.index).trim();
          if (part) commandParts.push(part);
        }
        cmdLastIndex = cmdMatch.index + 1; // +1 to skip the leading space
      }
      // Add remaining
      if (cmdLastIndex < commandText.length) {
        commandParts.push(commandText.slice(cmdLastIndex).trim());
      }

      // If we got multiple parts, use them; otherwise fall back to single
      if (commandParts.length > 1) {
        commandText = commandParts.join('\n');
      }
    }

    if (commandText) {
      segments.push({ type: 'command', content: commandText });
    }

    lastIndex = commandStartPos + commandEndPos;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      segments.push({ type: 'text', content: remaining });
    }
  }

  return segments;
}

/**
 * Format and display STIG check content or fix text with extracted commands
 */
export function FormattedSTIGContent({ content, type }: Props) {
  const segments = React.useMemo(() => parseSTIGContent(content), [content]);

  return (
    <div className="space-y-4">
      {segments.map((segment, i) => {
        if (segment.type === 'command') {
          // Drop blank lines inside extracted multi-command segments
          const command = segment.content
            .split('\n')
            .filter(line => line.trim())
            .join('\n');
          return <CommandBlock key={i} command={command} className="my-2" />;
        }
        return (
          <p key={i} className="text-sm text-muted-foreground leading-relaxed">
            {segment.content}
          </p>
        );
      })}
    </div>
  );
}
