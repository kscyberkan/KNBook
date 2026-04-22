import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EMOJIS } from './emojiList';

interface EmojiPickerProps {
  open: boolean;
  onSelect: (emojiId: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ open, onSelect, onClose }) => (
  <AnimatePresence>
    {open && (
      <>
        <div className="fixed inset-0 z-10" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full mb-2 left-0 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 grid grid-cols-6 gap-1 z-20 w-56"
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
