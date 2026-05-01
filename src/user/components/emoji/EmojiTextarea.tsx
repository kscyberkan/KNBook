import React, { useRef, useEffect, useState } from 'react';
import { EMOJI_MAP } from './emojiList';

interface EmojiTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  style?: React.CSSProperties;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

/** แปลง raw emoji code เช่น :heart: เป็นตัว emoji character */
function normalizeEmojiText(text: string): string {
  return text.replace(/:(\w+):/g, (match, id) => {
    const emoji = EMOJI_MAP.get(id);
    return emoji?.char ?? match;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderEmojiOverlay(text: string): string {
  const emojiChars = Array.from(EMOJI_MAP.values())
    .map((emoji) => emoji.char)
    .filter(Boolean) as string[];

  if (!emojiChars.length) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  const emojiRegex = new RegExp(`(${emojiChars.map(escapeRegExp).join('|')})`, 'gu');
  return escapeHtml(text)
    .replace(emojiRegex, (match) => {
      const emoji = Array.from(EMOJI_MAP.values()).find((entry) => entry.char === match);
      if (!emoji) return match;
      const svg = emoji.svg.replace(
        /<svg([^>]*)>/,
        '<svg$1 style="width:100%;height:100%;display:block;">'
      );
      return `<span style="position:relative;display:inline-block;line-height:inherit;font-family:inherit;font-size:inherit;vertical-align:middle;">` +
        `<span style="visibility:hidden;user-select:none;white-space:nowrap;">${match}</span>` +
        `<span style="position:absolute;inset:0;display:inline-flex;align-items:center;justify-content:center;pointer-events:none;">${svg}</span>` +
        `</span>`;
    })
    .replace(/\n/g, '<br>');
}

function renderOverlay(text: string, caretIndex: number | null = null): string {
  if (caretIndex === null || caretIndex < 0 || caretIndex > text.length) {
    return renderEmojiOverlay(text);
  }

  const prefix = renderEmojiOverlay(text.slice(0, caretIndex));
  const suffix = renderEmojiOverlay(text.slice(caretIndex));
  const caret = `<span style="display:inline-block;width:1px;height:1em;vertical-align:bottom;background:#374151;animation:blink 1s step-end infinite;transform:translateY(-0.25em);"></span>`;

  return `${prefix}${caret}${suffix}`;
}

export const EmojiTextarea: React.FC<EmojiTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder,
  className = '',
  rows = 1,
  style = {},
  textareaRef: externalRef,
}) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = (externalRef as React.RefObject<HTMLTextAreaElement>) ?? internalRef;
  const overlayRef = useRef<HTMLDivElement>(null);
  const [caretIndex, setCaretIndex] = useState<number>(0);

  const updateCaretPosition = (target: HTMLTextAreaElement | null) => {
    if (!target) return;
    setCaretIndex(target.selectionStart ?? 0);
  };

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

  const normalizedValue = normalizeEmojiText(value);

  const overlayHtml = normalizedValue
    ? renderOverlay(normalizedValue, caretIndex)
    : `<span style="color:#9ca3af">${placeholder ?? ''}</span>`;

  return (
    <div className="relative flex-1" style={style}>
      <style>{`@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
      {/* Overlay — แสดง emoji */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 pointer-events-none whitespace-pre-wrap break-words overflow-hidden text-sm leading-relaxed py-0.5 ${className}`}
        style={{
          color: value ? '#374151' : '#9ca3af',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          letterSpacing: 'inherit',
        }}
        dangerouslySetInnerHTML={{ __html: overlayHtml }}
      />
      {/* Textarea จริง — transparent text */}
      <textarea
        ref={ref}
        value={normalizedValue}
        onChange={(e) => {
          onChange(normalizeEmojiText(e.target.value));
          updateCaretPosition(e.target);
        }}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          updateCaretPosition(e.target);
          onFocus?.();
        }}
        onBlur={onBlur}
        onSelect={(e) => updateCaretPosition(e.currentTarget)}
        onKeyUp={(e) => updateCaretPosition(e.currentTarget)}
        onClick={(e) => updateCaretPosition(e.currentTarget)}
        onScroll={syncScroll}
        placeholder=""
        rows={rows}
        className={`relative w-full bg-transparent border-none focus:outline-none resize-none overflow-hidden leading-relaxed text-sm py-0.5 ${className}`}
        style={{ ...style, color: 'transparent', caretColor: 'transparent', WebkitTextFillColor: 'transparent' }}
      />
    </div>
  );
};
