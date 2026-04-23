import React from 'react';
import { getEmojiSvg } from './emojiList';
import { type User } from '../../types';

export function parseEmojiText(
  text: string,
  mentionUsers?: User[],
  onMentionClick?: (user: User) => void
): React.ReactNode[] {
  const sortedNames = (mentionUsers ?? [])
    .map(u => u.name)
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const mentionPattern = sortedNames.length > 0
    ? `@(?:${sortedNames.join('|')})|@\\S+`
    : `@\\S+`;

  const fullPattern = new RegExp(`(:\\w+:|${mentionPattern})`, 'g');
  const parts = text.split(fullPattern);

  return parts.map((part, i) => {
    const emojiMatch = part.match(/^:(\w+):$/);
    if (emojiMatch) {
      const svg = getEmojiSvg(emojiMatch[1]!);
      if (svg) {
        return (
          <span key={i} className="inline-block align-middle" style={{ width: 20, height: 20 }}
            dangerouslySetInnerHTML={{ __html: svg }} />
        );
      }
    }
    if (part.startsWith('@') && onMentionClick) {
      const name = part.slice(1).trim();
      const user = mentionUsers?.find(u => u.name === name);
      return (
        <span
          key={i}
          className="text-[#5B65F2] font-medium cursor-pointer hover:underline"
          onClick={() => user && onMentionClick(user)}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface EmojiTextProps {
  text: string;
  className?: string;
  mentionUsers?: User[];
  onMentionClick?: (user: User) => void;
}

export const EmojiText: React.FC<EmojiTextProps> = ({ text, className, mentionUsers, onMentionClick }) => (
  <span className={className}>{parseEmojiText(text, mentionUsers, onMentionClick)}</span>
);
