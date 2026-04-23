import React, { useRef, useEffect } from 'react';
import { EMOJI_MAP } from './emojiList';

interface EmojiTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

/** แปลง text ที่มี :emojiId: เป็น HTML string สำหรับ overlay */
function renderOverlay(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/:(\w+):/g, (match, id) => {
      const emoji = EMOJI_MAP.get(id);
      if (!emoji) return match;
      return `<span class="inline-block align-middle" style="width:18px;height:18px;vertical-align:middle">${emoji.svg}</span>`;
    })
    // แทน newline ด้วย <br>
    .replace(/\n/g, '<br>');
}

export const EmojiTextarea: React.FC<EmojiTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  className = '',
  rows = 1,
  textareaRef: externalRef,
}) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = (externalRef as React.RefObject<HTMLTextAreaElement>) ?? internalRef;
  const overlayRef = useRef<HTMLDivElement>(null);

  // sync scroll
  const syncScroll = () => {
    if (ref.current && overlayRef.current) {
      overlayRef.current.scrollTop = ref.current.scrollTop;
    }
  };

  // auto-resize
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  const overlayHtml = value
    ? renderOverlay(value)
    : `<span style="color:#9ca3af">${placeholder ?? ''}</span>`;

  return (
    <div className="relative flex-1">
      {/* Overlay — แสดง emoji */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden text-sm leading-relaxed py-0.5 ${className}`}
        style={{ color: value ? '#374151' : '#9ca3af' }}
        dangerouslySetInnerHTML={{ __html: overlayHtml }}
      />
      {/* Textarea จริง — transparent text */}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onScroll={syncScroll}
        placeholder=""
        rows={rows}
        className={`relative w-full bg-transparent border-none focus:outline-none resize-none overflow-hidden leading-relaxed text-sm py-0.5 ${className}`}
        style={{ color: 'transparent', caretColor: '#374151', WebkitTextFillColor: 'transparent' }}
      />
    </div>
  );
};
