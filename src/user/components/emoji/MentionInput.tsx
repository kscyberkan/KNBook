import React, { useRef, useEffect, useCallback, useState } from 'react';
import { type User } from '../../../types';
import { EMOJI_MAP } from './emojiList';
import { motion, AnimatePresence } from 'framer-motion';

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  onMentionClick?: (user: User) => void;
  placeholder?: string;
  className?: string;
  mentionUsers?: User[];
  divRef?: React.RefObject<HTMLDivElement | null>;
}

// save/restore cursor position
function saveCursor(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

function restoreCursor(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  let pos = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (pos + len >= offset) {
        const range = document.createRange();
        range.setStart(node, offset - pos);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
      pos += len;
    } else {
      for (const child of Array.from(node.childNodes)) {
        if (walk(child)) return true;
      }
    }
    return false;
  };
  walk(el);
}

// extract plain text จาก contenteditable
function extractText(el: HTMLElement): string {
  let text = '';
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node.nodeName === 'BR') {
      text += '\n';
    } else if (node.nodeName === 'SPAN') {
      const span = node as HTMLElement;
      if (span.dataset.emojiId) {
        text += `:${span.dataset.emojiId}:`;
      } else if (span.dataset.userName) {
        text += `@${span.dataset.userName}`;
      } else {
        text += span.textContent ?? '';
      }
    } else if (node.nodeName === 'DIV') {
      text += '\n' + extractText(node as HTMLElement);
    }
  });
  return text;
}

// render nodes จาก plain text
function buildNodes(text: string, mentionUsers: User[]): Node[] {
  const sortedNames = mentionUsers
    .map(u => u.name)
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const pattern = sortedNames.length > 0
    ? new RegExp(`(:\\w+:|@(?:${sortedNames.join('|')}))`, 'g')
    : new RegExp(`(:\\w+:)`, 'g');

  const nodes: Node[] = [];
  const parts = text.split(pattern);

  parts.forEach(part => {
    // emoji :id:
    const emojiMatch = part.match(/^:(\w+):$/);
    if (emojiMatch) {
      const emoji = EMOJI_MAP.get(emojiMatch[1]!);
      if (emoji) {
        const span = document.createElement('span');
        span.contentEditable = 'false';
        span.dataset.emojiId = emoji.id;
        span.style.cssText = 'display:inline-block;width:1.25em;height:1.25em;vertical-align:middle;pointer-events:none;';
        span.innerHTML = emoji.svg.replace(/<svg([^>]*)>/, '<svg$1 style="width:100%;height:100%;display:block;">');
        nodes.push(span);
        return;
      }
    }
    // @mention
    if (part.startsWith('@') && sortedNames.length > 0) {
      const name = part.slice(1);
      const user = mentionUsers.find(u => u.name === name);
      if (user) {
        const span = document.createElement('span');
        span.className = 'mention-tag';
        span.contentEditable = 'false';
        span.dataset.userId = user.id;
        span.dataset.userName = user.name;
        span.textContent = part;
        span.style.cssText = 'color:#5B65F2;font-weight:600;cursor:pointer;pointer-events:auto;';
        nodes.push(span);
        return;
      }
    }
    if (part) nodes.push(document.createTextNode(part));
  });

  return nodes;
}

/** หา @query ที่ cursor อยู่ใน text ณ ตำแหน่ง caretPos */
function getMentionQuery(text: string, caretPos: number): string | null {
  const before = text.slice(0, caretPos);
  const match = before.match(/@(\S*)$/);
  return match ? match[1]! : null;
}

/** แทนที่ @query ที่ cursor ด้วย @name */
function replaceMentionQuery(text: string, caretPos: number, name: string): { text: string; cursor: number } {
  const before = text.slice(0, caretPos);
  const after = text.slice(caretPos);
  const replaced = before.replace(/@(\S*)$/, `@${name} `);
  return { text: replaced + after, cursor: replaced.length };
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onMentionClick,
  placeholder,
  className = '',
  mentionUsers = [],
  divRef: externalDivRef,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const divRef = (externalDivRef as React.RefObject<HTMLDivElement>) ?? internalRef;
  const isComposingRef = useRef(false);
  const lastValueRef = useRef(value);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const mentionResults = mentionQuery !== null
    ? mentionUsers.filter(u =>
        u.name.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  // sync DOM เมื่อ value เปลี่ยนจากภายนอก
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const current = extractText(el);
    if (current === value) return;

    const cursor = saveCursor(el);
    el.innerHTML = '';
    if (value) {
      buildNodes(value, mentionUsers).forEach(n => el.appendChild(n));
    }
    restoreCursor(el, cursor);
    lastValueRef.current = value;
  }, [value]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    const el = divRef.current;
    if (!el) return;
    const text = extractText(el);
    lastValueRef.current = text;
    onChange(text);

    // detect @mention query
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      const caretPos = pre.toString().length;
      const query = getMentionQuery(text, caretPos);
      setMentionQuery(query);
      setMentionIndex(0);
    }
  }, [onChange]);

  const selectMention = useCallback((user: User) => {
    const el = divRef.current;
    if (!el) return;

    const text = extractText(el);
    const sel = window.getSelection();
    let caretPos = text.length;
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      caretPos = pre.toString().length;
    }

    const { text: newText, cursor } = replaceMentionQuery(text, caretPos, user.name);
    onChange(newText);
    setMentionQuery(null);

    // rebuild DOM และ restore cursor
    requestAnimationFrame(() => {
      if (!el) return;
      el.innerHTML = '';
      buildNodes(newText, mentionUsers).forEach(n => el.appendChild(n));
      restoreCursor(el, cursor);
      el.focus();
    });
  }, [onChange, mentionUsers]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const user = mentionResults[mentionIndex];
        if (user) {
          e.preventDefault();
          selectMention(user);
          return;
        }
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  }, [mentionQuery, mentionResults, mentionIndex, selectMention, onKeyDown]);

  return (
    <div className="relative flex-1">
      {/* Placeholder */}
      {!value && (
        <div className="absolute px-2 py-2 inset-0 pointer-events-none text-sm text-gray-400 py-0.5 leading-relaxed">
          {placeholder}
        </div>
      )}

      {/* Mention dropdown */}
      <AnimatePresence>
        {mentionQuery !== null && mentionResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-0 mb-1.5 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
          >
            {mentionResults.map((user, idx) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectMention(user); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  idx === mentionIndex ? 'bg-[#5B65F2]/8 text-[#5B65F2]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <img
                  src={user.profileImage}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
                <span className="font-medium truncate">{user.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setMentionQuery(null);
          onBlur?.();
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          // handle click บน mention-tag span หรือ parent ที่มี mention-tag
          const mentionEl = target.classList.contains('mention-tag')
            ? target
            : (target.closest('.mention-tag') as HTMLElement | null);
          if (mentionEl && onMentionClick) {
            const user = mentionUsers.find(u => u.id === mentionEl.dataset.userId);
            if (user) {
              e.preventDefault();
              e.stopPropagation();
              onMentionClick(user);
            }
          }
        }}
        className={`relative focus:outline-none text-sm leading-relaxed py-0.5 max-h-28 overflow-y-auto text-gray-700 ${className}`}
        style={{ minHeight: '1.25rem', wordBreak: 'break-word' }}
      />
    </div>
  );
};
