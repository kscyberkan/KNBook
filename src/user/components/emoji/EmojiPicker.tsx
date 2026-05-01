import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EMOJIS } from './emojiList';

interface EmojiPickerProps {
  open: boolean;
  onSelect: (emojiId: string) => void;
  onClose: () => void;
  placement?: 'top' | 'bottom';
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  open,
  onSelect,
  onClose,
  placement = 'top',
  anchorRef,
}) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Phase 1: open → render hidden picker to measure
  // Phase 2: after measure → set real position
  const [phase, setPhase] = useState<'hidden' | 'visible'>('hidden');

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      setPhase('hidden');
      return;
    }
    if (!anchorRef?.current || !pickerRef.current) return;
    if (phase === 'visible') return; // already positioned, stop

    const anchor = anchorRef.current.getBoundingClientRect();
    const picker = pickerRef.current.getBoundingClientRect();
    const pickerW = picker.width || 224;
    const pickerH = picker.height || 120;

    let left = anchor.right - pickerW;
    let top = placement === 'top'
      ? anchor.top - pickerH - 8
      : anchor.bottom + 8;

    if (placement === 'top' && top < 8) top = anchor.bottom + 8;
    if (placement === 'bottom' && top + pickerH > window.innerHeight - 8) top = anchor.top - pickerH - 8;
    if (left < 8) left = 8;
    if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;

    setPos({ top, left });
    setPhase('visible');
  }, [open, phase, anchorRef, placement]);

  const hasAnchor = !!anchorRef;

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[9990]" onClick={onClose} />
          <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: phase === 'visible' ? 1 : 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={
              hasAnchor
                ? pos
                  ? { position: 'fixed', top: pos.top, left: pos.left, width: 224 }
                  : { position: 'fixed', top: -9999, left: -9999, width: 224 }
                : { position: 'absolute', [placement === 'top' ? 'bottom' : 'top']: '100%', right: 0, width: 224 }
            }
            className="bg-white border border-gray-100 rounded-2xl shadow-xl p-2 grid grid-cols-6 gap-1 z-[9991]"
          >
            {EMOJIS.map(emoji => (
              <button
                key={emoji.id}
                title={emoji.label}
                onClick={() => { onSelect(emoji.id); onClose(); }}
                className="p-1.5 rounded-xl hover:bg-gray-100 transition-all hover:scale-125"
                dangerouslySetInnerHTML={{ __html: emoji.svg }}
                style={{ width: 36, height: 36 }}
              />
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
