import React, { useRef, useEffect, useCallback } from 'react';
import { type User } from '../../types';

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
      if (span.dataset.userName) {
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

// render HTML จาก plain text — ไม่ใช้ dangerouslySetInnerHTML โดยตรง
function buildNodes(text: string, mentionUsers: User[]): Node[] {
  const sortedNames = mentionUsers
    .map(u => u.name)
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const pattern = sortedNames.length > 0
    ? new RegExp(`(@(?:${sortedNames.join('|')}))`, 'g')
    : null;

  const nodes: Node[] = [];
  const parts = pattern ? text.split(pattern) : [text];

  parts.forEach(part => {
    if (part.startsWith('@') && pattern) {
      const name = part.slice(1);
      const user = mentionUsers.find(u => u.name === name);
      if (user) {
        const span = document.createElement('span');
        span.className = 'mention-tag';
        span.contentEditable = 'false';
        span.dataset.userId = user.id;
        span.dataset.userName = user.name;
        span.textContent = part;
        nodes.push(span);
        return;
      }
    }
    if (part) nodes.push(document.createTextNode(part));
  });

  return nodes;
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

  // sync DOM เมื่อ value เปลี่ยนจากภายนอก (เช่น clear หลัง submit)
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const current = extractText(el);
    if (current === value) return; // ไม่ต้อง sync ถ้าเหมือนกัน

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
  }, [onChange]);

  return (
    <div className="relative flex-1">
      {/* Placeholder */}
      {!value && (
        <div className="absolute inset-0 pointer-events-none text-sm text-gray-400 py-0.5 leading-relaxed">
          {placeholder}
        </div>
      )}
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('mention-tag') && onMentionClick) {
            const user = mentionUsers.find(u => u.id === target.dataset.userId);
            if (user) onMentionClick(user);
          }
        }}
        className={`relative focus:outline-none text-sm leading-relaxed py-0.5 max-h-28 overflow-y-auto text-gray-700 ${className}`}
        style={{ minHeight: '1.25rem', wordBreak: 'break-word' }}
      />
    </div>
  );
};
