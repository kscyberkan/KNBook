import React, { useState, useRef } from 'react';
import { Send, StickyNote, Image as ImageIcon, X, Smile } from 'lucide-react';
import { type User, type Comment } from '../../types';
import { AnimatePresence, motion } from 'framer-motion';
import { MentionInput } from './emoji/MentionInput';
import { EmojiPicker } from './emoji/EmojiPicker';
import { getEmojiChar } from './emoji/emojiList';

interface CommentInputProps {
  currentUser: User;
  replyTo?: Comment | null;
  onCancelReply?: () => void;
  onSubmit: (text: string, imageUrl?: string, stickerUrl?: string, replyToId?: string) => void;
  mentionUsers?: User[];
  placeholder?: string;
  compact?: boolean;
  initialText?: string;
  onInitialTextConsumed?: () => void;
}

const STICKERS = [
  '/media/0/stickers/sticker1.svg',
  '/media/0/stickers/sticker2.svg',
  '/media/0/stickers/sticker3.svg',
  '/media/0/stickers/sticker4.svg',
  '/media/0/stickers/sticker5.svg',
  '/media/0/stickers/sticker6.svg',
];

export const CommentInput: React.FC<CommentInputProps> = ({
  currentUser,
  replyTo,
  onCancelReply,
  onSubmit,
  mentionUsers = [],
  placeholder,
  compact = false,
  initialText,
  onInitialTextConsumed,
}) => {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sticker, setSticker] = useState<string | null>(null);
  const [showSticker, setShowSticker] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // set initialText และ focus เมื่อมีค่าใหม่
  React.useEffect(() => {
    if (initialText) {
      setText(initialText);
      onInitialTextConsumed?.();
      setTimeout(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }, 50);
    }
  }, [initialText]);

  const hasContent = !!(text.trim() || image || sticker);

  const handleSubmit = async () => {
    if (!hasContent) return;
    let uploadedUrl: string | undefined;
    if (imageFile) {
      const form = new FormData();
      form.append('file', imageFile);
      form.append('source', 'chat');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json() as { url?: string };
      uploadedUrl = json.url;
    }
    const replyToId = replyTo?.id && !replyTo.id.startsWith('init-') ? replyTo.id : undefined;
    onSubmit(text.trim(), uploadedUrl || image || undefined, sticker || undefined, replyToId);
    setText('');
    setImage(null);
    setImageFile(null);
    setSticker(null);
    setShowSticker(false);
    setShowEmoji(false);
  };

  const avatarSize = compact ? 'w-7 h-7' : 'w-8 h-8';

  return (
    <div className={compact ? '' : 'px-4 pb-3 pt-2'}>
      {/* Reply indicator */}
      <AnimatePresence>
        {replyTo && !compact && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-[#5B65F2]/5 rounded-xl border border-[#5B65F2]/10"
          >
            <span className="text-xs text-gray-500">ตอบกลับ <span className="font-semibold text-[#5B65F2]">{replyTo.user.name}</span></span>
            <button onClick={onCancelReply} className="ml-auto text-gray-400 hover:text-gray-600"><X size={12} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image/Sticker preview */}
      <AnimatePresence>
        {(image || sticker) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-2 flex gap-2 flex-wrap">
            {image && (
              <div className="relative inline-block">
                <img src={image} alt="preview" className="max-h-20 rounded-xl object-contain border border-gray-100" />
                <button
                  onClick={() => { setImage(null); setImageFile(null); }}
                  className="absolute -top-1 -right-1 bg-gray-800 text-white p-0.5 rounded-full"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {sticker && (
              <div className="relative inline-block">
                <img src={sticker} alt="sticker preview" className="w-16 h-16 rounded-xl object-contain border border-gray-100 bg-gray-50" />
                <button
                  onClick={() => setSticker(null)}
                  className="absolute -top-1 -right-1 bg-gray-800 text-white p-0.5 rounded-full"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticker picker */}
      <AnimatePresence>
        {showSticker && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-2 p-2 bg-white border border-gray-100 rounded-2xl shadow-lg grid grid-cols-6 gap-1"
          >
            {STICKERS.map(url => (
              <button key={url} onClick={() => { setSticker(url); setShowSticker(false); }}
                className={`p-1 rounded-xl hover:bg-gray-100 transition-all hover:scale-110 ${sticker === url ? 'bg-[#5B65F2]/10 ring-1 ring-[#5B65F2]' : ''}`}>
                <img src={url} className="w-10 h-10 object-contain" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <img
          src={currentUser.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`}
          className={`${avatarSize} rounded-full object-cover flex-shrink-0`}
        />
        <div className="flex-1 flex items-end bg-gray-100 hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#5B65F2]/20 rounded-2xl px-3 py-2 transition-all border border-transparent focus-within:border-gray-200 relative">
          <MentionInput
            value={text}
            onChange={setText}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={placeholder || (replyTo ? `ตอบกลับ ${replyTo.user.name}...` : 'แสดงความคิดเห็น...')}
            mentionUsers={mentionUsers}
            divRef={inputRef}
            className="text-gray-700"
          />
          <div className="flex items-center gap-1 text-gray-400 ml-2 mb-0.5 relative">
            <div className="relative">
              <button
                ref={emojiButtonRef}
                onClick={() => { setShowEmoji(!showEmoji); setShowSticker(false); }}
                className={`p-1 rounded-lg transition-colors ${showEmoji ? 'text-yellow-500 bg-yellow-50' : 'hover:text-yellow-500 hover:bg-yellow-50'}`}
              >
                <Smile size={16} />
              </button>
              <EmojiPicker
                open={showEmoji}
                onSelect={(id) => setText(prev => prev + (getEmojiChar(id) || `:${id}:`))}
                onClose={() => setShowEmoji(false)}
                placement="top"
                anchorRef={emojiButtonRef as React.RefObject<HTMLElement | null>}
              />
            </div>
            <button
              onClick={() => { setShowSticker(!showSticker); setShowEmoji(false); }}
              className={`p-1 rounded-lg transition-colors ${showSticker ? 'text-purple-500 bg-purple-50' : 'hover:text-purple-500 hover:bg-purple-50'}`}
            >
              <StickyNote size={16} />
            </button>
            <button
              onClick={() => imageRef.current?.click()}
              className="p-1 rounded-lg hover:text-green-500 hover:bg-green-50 transition-colors"
            >
              <ImageIcon size={16} />
            </button>
            {hasContent && (
              <button onClick={handleSubmit} className="text-[#5B65F2] hover:text-[#4a54e1] transition-colors">
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      <input ref={imageRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImageFile(file);
          setImage(URL.createObjectURL(file));
          e.target.value = '';
        }}
      />
    </div>
  );
};
