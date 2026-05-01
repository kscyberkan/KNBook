import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Smile, Send, X, StickyNote } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { EmojiTextarea } from './emoji/EmojiTextarea';
import { Global } from '../Global';
import { motion, AnimatePresence } from 'framer-motion';
import { useDictionary } from '../../utils/dictionary';

interface CreatePostProps {
  onPost?: (postData: {
    text: string;
    imageUrl: string | null;
    videoUrl: string | null;
    imageFile?: File | null;
    videoFile?: File | null;
    feeling: string | null;
    stickerUrl: string | null;
  }) => void;
}

export const CreatePost: React.FC<CreatePostProps> = ({ onPost }) => {
  const { t } = useDictionary();
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [customFeeling, setCustomFeeling] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const feelings = [
    { name: t('feeling.happy'), icon: '😊' },
    { name: t('feeling.excited'), icon: '🤩' },
    { name: t('feeling.sad'), icon: '😢' },
    { name: t('feeling.sleepy'), icon: '😴' },
    { name: t('feeling.angry'), icon: '😡' },
    { name: t('feeling.surprised'), icon: '😮' },
  ];

  const stickers = [
    '/media/0/stickers/sticker1.svg',
    '/media/0/stickers/sticker2.svg',
    '/media/0/stickers/sticker3.svg',
    '/media/0/stickers/sticker4.svg',
    '/media/0/stickers/sticker5.svg',
    '/media/0/stickers/sticker6.svg',
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (isImage || isVideo) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile(reader.result as string);
        setSelectedFileObj(file);
        setFileType(isImage ? 'image' : 'video');
        setIsExpanded(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setSelectedFileObj(null);
    setFileType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {
    if (!text.trim() && !selectedFile && !feeling && !stickerUrl) return;
    if (posting) return;
    setPosting(true);
    try {
      await onPost?.({
        text: text.trim(),
        imageUrl: fileType === 'image' ? selectedFile : null,
        videoUrl: fileType === 'video' ? selectedFile : null,
        imageFile: fileType === 'image' ? selectedFileObj : null,
        videoFile: fileType === 'video' ? selectedFileObj : null,
        feeling,
        stickerUrl,
      });
      // reset หลัง onPost เสร็จเท่านั้น
      setText('');
      setSelectedFile(null);
      setSelectedFileObj(null);
      setFileType(null);
      setFeeling(null);
      setStickerUrl(null);
      setCustomFeeling('');
      setIsExpanded(false);
      setShowFeelingPicker(false);
      setShowStickerPicker(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setPosting(false);
    }
  };

  const hasContent = !!(text || selectedFile || feeling || stickerUrl);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 transition-all duration-300">
      <div className="p-4">
        <div className="flex items-start space-x-3">
          <img
            src={Global.user.profileImage}
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5 ring-2 ring-gray-100"
          />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-[15px]">{Global.user.name}</span>
              <AnimatePresence>
                {feeling && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-medium border border-amber-100"
                  >
                    <span>กำลังรู้สึก {feeling}</span>                    <button onClick={() => setFeeling(null)} className="hover:text-amber-900 ml-0.5">
                      <X size={11} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <EmojiTextarea
              placeholder={`${Global.user.name} ${t('post.placeholder')}`}
              value={text}
              onChange={setText}
              className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-gray-100 py-2.5 px-4 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B65F2]/15 transition-all duration-200 overflow-hidden text-[15px] leading-relaxed"
              style={{ minHeight: isExpanded || hasContent ? '100px' : '42px' }}
              onFocus={() => setIsExpanded(true)}
              onBlur={() => { if (!hasContent) setIsExpanded(false); }}
            />

            {/* Sticker Preview */}
            <AnimatePresence>
              {stickerUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative w-28 h-28 group"
                >
                  <img src={stickerUrl} alt="Sticker" className="w-full h-full object-contain" />
                  <button
                    onClick={() => setStickerUrl(null)}
                    className="absolute -top-1 -right-1 bg-gray-800 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* File Preview */}
            <AnimatePresence>
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="relative rounded-xl overflow-hidden border border-gray-100 group"
                >
                  {fileType === 'image' ? (
                    <>
                      <img src={selectedFile} alt="Selected" className="w-full h-auto max-h-72 object-cover" />
                      <button
                        onClick={removeFile}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors z-10 shadow-md"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="w-full aspect-video">
                      <VideoPlayer src={selectedFile} onClose={removeFile} title="Video Preview" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Feeling Picker */}
      <AnimatePresence>
        {showFeelingPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-100 bg-amber-50/30 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-700">{t('post.howFeeling')}</span>
                <button onClick={() => setShowFeelingPicker(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                {feelings.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => {
                      setFeeling(`${f.icon} ${f.name}`);
                      setShowFeelingPicker(false);
                      setIsExpanded(true);
                    }}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      feeling?.includes(f.name)
                        ? 'bg-amber-100 border-amber-200 text-amber-800'
                        : 'bg-white border-gray-100 hover:border-amber-200 hover:bg-amber-50 text-gray-700'
                    }`}
                  >
                    <span className="text-2xl">{f.icon}</span>
                    <span className="text-[11px] font-medium">{f.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-100 focus-within:border-amber-200 transition-colors">
                <Smile size={16} className="text-amber-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={t('post.otherFeeling')}
                  value={customFeeling}
                  onChange={(e) => setCustomFeeling(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customFeeling.trim()) {
                      setFeeling(`✨ ${customFeeling.trim()}`);
                      setCustomFeeling('');
                      setShowFeelingPicker(false);
                      setIsExpanded(true);
                    }
                  }}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 placeholder-gray-400"
                />
                {customFeeling.trim() && (
                  <button
                    onClick={() => {
                      setFeeling(`✨ ${customFeeling.trim()}`);
                      setCustomFeeling('');
                      setShowFeelingPicker(false);
                      setIsExpanded(true);
                    }}
                    className="text-amber-600 hover:text-amber-700 font-bold text-sm px-2"
                  >
                    {t('common.ok')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticker Picker */}
      <AnimatePresence>
        {showStickerPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-100 bg-purple-50/20 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-700">{t('post.chooseSticker')}</span>
                <button onClick={() => setShowStickerPicker(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {stickers.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setStickerUrl(url);
                      setShowStickerPicker(false);
                      setIsExpanded(true);
                    }}
                    className={`p-2 rounded-xl border-2 transition-all hover:scale-105 ${
                      stickerUrl === url ? 'border-[#5B65F2] bg-[#5B65F2]/5 shadow-sm' : 'border-transparent hover:border-gray-200 bg-white'
                    }`}
                  >
                    <img src={url} alt={`Sticker ${idx}`} className="w-full h-auto object-contain" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Bar */}
      <div className="border-t border-gray-100 grid grid-cols-4">
        <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-3 hover:bg-gray-50 transition-colors text-gray-500 group"
        >
          <ImageIcon size={18} className="text-green-500 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium hidden sm:block">{t('post.photoVideo')}</span>
        </button>
        <button
          onClick={() => { setShowStickerPicker(!showStickerPicker); setShowFeelingPicker(false); }}
          className={`flex items-center justify-center gap-1.5 py-3 hover:bg-gray-50 transition-colors text-gray-500 group ${showStickerPicker ? 'bg-purple-50' : ''}`}
        >
          <StickyNote size={18} className="text-purple-500 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium hidden sm:block">{t('post.sticker')}</span>
        </button>
        <button
          onClick={() => { setShowFeelingPicker(!showFeelingPicker); setShowStickerPicker(false); }}
          className={`flex items-center justify-center gap-1.5 py-3 hover:bg-gray-50 transition-colors text-gray-500 group ${showFeelingPicker ? 'bg-amber-50' : ''}`}
        >
          <Smile size={18} className="text-amber-500 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium hidden sm:block">{t('post.feeling')}</span>
        </button>
        <button
          onClick={handlePost}
          disabled={!hasContent || posting}
          className={`flex items-center justify-center gap-1.5 py-3 transition-all duration-200 font-semibold text-sm ${
            hasContent && !posting
              ? 'bg-[#5B65F2] text-white hover:bg-[#4a54e1] active:scale-95'
              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
          }`}
        >
          {posting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
          <span className="text-xs font-medium hidden sm:block">{posting ? t('post.posting') : t('post.create')}</span>
        </button>
      </div>
      {/* Upload progress bar */}
      {posting && (
        <div className="h-1 bg-gray-100 rounded-b-2xl overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#5B65F2] to-[#7B83F5] transition-all duration-300 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
};
