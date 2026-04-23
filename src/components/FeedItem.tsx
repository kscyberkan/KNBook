import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp, MessageCircle, Share2, Image as ImageIcon, StickyNote, Send, Heart, Laugh, Annoyed, Frown, Angry, MoreHorizontal, X, Reply, Flag, Bookmark } from 'lucide-react';
import { Global } from '../Global';
import { VideoPlayer } from './VideoPlayer';
import { type User, type Post, type Comment } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';
import { EmojiPicker } from './emoji/EmojiPicker';
import { EmojiText } from './emoji/EmojiText';
import { MentionInput } from './emoji/MentionInput';
import { CommentInput } from './CommentInput';
import { modal } from './Modal';

interface FeedItemProps {
  postId?: string;
  user: User;
  createdAt?: string;
  disableAnimation?: boolean;
  onUserClick?: () => void;
  postText?: string;
  postImageUrl?: string;
  postVideoUrl?: string;
  feeling?: string;
  stickerUrl?: string;
  initialReactionsCount?: Record<string, number>;
  initialReactedUsers?: Record<string, string[]>;
  initialComments?: Comment[];
  sharedPost?: Post;
  onShare?: () => void;
  onBookmark?: (bookmarked: boolean) => void;
  initialBookmarked?: boolean;
  onReact?: (type: string | null) => void;
  onComment?: (text: string, imageUrl?: string, stickerUrl?: string, replyToId?: string) => void;
  onCommentUserClick?: (user: User) => void;
}

function SharedPost({ post, isSub, onUserClick }: { post?: Post; isSub?: boolean; onUserClick?: (user: User) => void }) {
  if (!post) return null;
  return (
    <div className={`rounded-xl overflow-hidden ${isSub ? 'mx-0 border-t-1' : 'mx-3 mb-3 border border-gray-200'} bg-gray-50 border-gray-200`}>
      <div className="p-3 flex items-center space-x-2 border-b border-gray-100 bg-white/60">
        <img
          src={post.user.profileImage}
          alt={post.user.name}
          className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onUserClick?.(post.user)}
        />
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className="font-semibold text-sm text-gray-900 cursor-pointer hover:text-[#5B65F2] transition-colors"
              onClick={() => onUserClick?.(post.user)}
            >
              {post.user.name}
            </span>
            {post.feeling && (
              <span className="text-[11px] text-gray-400">กำลังรู้สึก <span className="text-gray-600">{post.feeling}</span></span>
            )}
          </div>
          <div className="text-[10px] text-gray-400">โพสต์ต้นฉบับ · {formatRelativeTime(post.createdAt)}</div>
        </div>
      </div>
      <div className="bg-white">
        {post.videoUrl && (
          <div className="w-full aspect-video">
            <VideoPlayer src={post.videoUrl} autoPlay={false} />
          </div>
        )}
        {post.imageUrl && !post.videoUrl && (
          <img src={post.imageUrl} alt="Shared Post" className="w-full h-auto object-cover max-h-[280px]" />
        )}
        {post.text && <div className="p-3 text-sm text-gray-700 whitespace-pre-wrap">{post.text}</div>}
        {post.stickerUrl && (
          <div className="p-3 flex justify-center">
            <img src={post.stickerUrl} alt="Sticker" className="w-20 h-20 object-contain" />
          </div>
        )}
      </div>
      {post.sharedPost && <SharedPost post={post.sharedPost} isSub onUserClick={onUserClick} />}
    </div>
  );
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'เมื่อกี้';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CommentThread({ comment, replies, onCommentUserClick, onReply, comments, onComment, currentUser }: {
  comment: Comment;
  replies: Comment[];
  onCommentUserClick?: (user: User) => void;
  onReply: (c: Comment) => void;
  comments: Comment[];
  onComment?: (text: string, imageUrl?: string, stickerUrl?: string, replyToId?: string) => void;
  currentUser: User;
}) {
  const [showReplies, setShowReplies] = React.useState(replies.length > 0);
  const [prefillText, setPrefillText] = React.useState('');
  const inlineInputRef = React.useRef<{ focus: () => void; setText: (t: string) => void } | null>(null);
  const allUsers = comments.map(c => c.user);

  // auto-expand เมื่อมี reply ใหม่
  React.useEffect(() => {
    if (replies.length > 0) setShowReplies(true);
  }, [replies.length]);

  // auto-expand เมื่อมี reply ใหม่เข้ามา
  React.useEffect(() => {
    if (replies.length > 0 && showReplies === false && replies.length === 1) {
      setShowReplies(true);
    }
  }, [replies.length]);

  const CommentBubble = ({ c, isReply }: { c: Comment; isReply?: boolean }) => (
    <div className="flex items-start gap-2">
      <img
        src={c.user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user.name}`}
        alt={c.user.name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer"
        onClick={() => onCommentUserClick?.(c.user)}
      />
      <div className="flex-1">
        <div className="bg-gray-50 rounded-2xl px-3 py-2">
          <span
            className="text-xs font-bold text-gray-900 cursor-pointer hover:text-[#5B65F2] transition-colors mr-1"
            onClick={() => onCommentUserClick?.(c.user)}
          >
            {c.user.name}
          </span>
          {c.text && <EmojiText text={c.text} className="text-sm text-gray-700 whitespace-pre-wrap" mentionUsers={allUsers} onMentionClick={(u) => onCommentUserClick?.(u)} />}
          {c.imageUrl && <img src={c.imageUrl} alt="comment" className="mt-1.5 max-w-[200px] rounded-xl object-cover" />}
          {c.stickerUrl && <img src={c.stickerUrl} alt="sticker" className="mt-1 w-16 h-16 object-contain" />}
        </div>
        <div className="flex items-center gap-3 mt-1 ml-2">
          <span className="text-[10px] text-gray-400">{formatRelativeTime(c.createdAt)}</span>
          <button
            onClick={() => {
              if (isReply) {
                // reply ของ reply → focus inline input + @ชื่อ
                setShowReplies(true);
                setPrefillText(`@${c.user.name} `);
                setTimeout(() => inlineInputRef.current?.focus(), 50);
              } else {
                onReply(c);
              }
            }}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#5B65F2] transition-colors"
          >
            <Reply size={12} /> ตอบกลับ
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
      <CommentBubble c={comment} />
      {replies.length > 0 && (
        <div className="ml-10 mt-1.5">
          {/* เส้นแนวตั้ง + ปุ่มดู replies */}
          <div className="relative pl-4 border-l-2 border-gray-100 space-y-2">
            {!showReplies && replies.length > 0 ? (
              <button
                onClick={() => setShowReplies(true)}
                className="text-xs text-[#5B65F2] font-semibold hover:underline py-1"
              >
                ดูการตอบกลับทั้ง {replies.length} รายการ
              </button>
            ) : (
              <AnimatePresence>
                {replies.map(r => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    <CommentBubble c={r} isReply />
                  </motion.div>
                ))}
                {replies.length > 0 && (
                  <button onClick={() => setShowReplies(false)} className="text-xs text-gray-400 hover:text-gray-600 py-1">
                    ซ่อนการตอบกลับ
                  </button>
                )}
              </AnimatePresence>
            )}

            {/* Inline reply input */}
            <CommentInput
              currentUser={currentUser}
              replyTo={comment}
              initialText={prefillText}
              onInitialTextConsumed={() => setPrefillText('')}
              onSubmit={(text, img, sticker, replyToId) => {
                onComment?.(text, img, sticker, replyToId);
                setShowReplies(true);
              }}
              mentionUsers={comments.map(c => c.user)}
              compact
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export const FeedItem: React.FC<FeedItemProps> = ({
  postId,
  user,
  createdAt,
  disableAnimation,
  onUserClick,
  postText,
  postImageUrl,
  postVideoUrl,
  feeling,
  stickerUrl,
  initialReactionsCount = {},
  initialReactedUsers = {},
  initialComments,
  sharedPost,
  onShare,
  onBookmark,
  initialBookmarked = false,
  onReact,
  onComment,
  onCommentUserClick,
}) => {
  const [commentText, setCommentText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{id: string; name: string; profileImage: string}[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [comments, setComments] = useState<Comment[]>(
    (initialComments ?? []).map((c: any) => ({
      ...c,
      id: String(c.id ?? `init-${Math.random()}`),
      user: { ...c.user, id: String(c.user?.id ?? '') },
    }))
  );
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentSticker, setCommentSticker] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const commentImageRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const reactionPickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [reactionsCount, setReactionsCount] = useState<Record<string, number>>(initialReactionsCount);
  const [reactedUsers, setReactedUsers] = useState<Record<string, string[]>>(initialReactedUsers);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportCustomText, setReportCustomText] = useState('');
  const [bookmarked, setBookmarked] = useState(initialBookmarked);

  // sync เมื่อ parent อัปเดต initialBookmarked (เช่น หลัง BOOKMARK_IDS โหลดมา)
  useEffect(() => {
    setBookmarked(initialBookmarked);
  }, [initialBookmarked]);
  const [showLikedByPopup, setShowLikedByPopup] = useState(false);
  const [likedByPopupData, setLikedByPopupData] = useState<{ type: string; color: string; users: string[] }[]>([]);
  const [likedByPopupPosition, setLikedByPopupPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    // MentionInput จัดการ height เอง
  }, [commentText]);

  // รับ comment ใหม่ real-time สำหรับโพสต์นี้
  useEffect(() => {
    if (!postId) return;
    const unsub = net.on(PacketSC.NEW_COMMENT, (packet: Packet) => {
      const incomingPostId = String(packet.readInt());
      if (incomingPostId !== postId) return;
      const comment = JSON.parse(packet.readString()) as Comment;
      const normalizedId = String(comment.id);
      setComments(prev => {
        if (prev.some(c => String(c.id) === normalizedId)) return prev;
        return [...prev, { ...comment, id: normalizedId, user: { ...comment.user, id: String(comment.user.id) } }];
      });
    });
    return () => unsub();
  }, [postId]);

  const handleSendComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed && !commentImage && !commentSticker) return;

    let uploadedImageUrl: string | undefined;
    if (commentImageFile) {
      const form = new FormData();
      form.append('file', commentImageFile);
      form.append('source', 'chat');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json() as { url?: string };
      uploadedImageUrl = json.url;
    }

    // ส่งไป server — รอ NEW_COMMENT broadcast กลับมาแสดง
    const replyToId = replyTo?.id && !replyTo.id.startsWith('init-') ? replyTo.id : undefined;
    onComment?.(trimmed, uploadedImageUrl || commentImage || undefined, commentSticker || undefined, replyToId);

    setCommentText('');
    setCommentImage(null);
    setCommentImageFile(null);
    setCommentSticker(null);
    setReplyTo(null);
    setShowStickerPicker(false);
    setShowEmojiPicker(false);
  };

  const selectMention = (u: {id: string; name: string; profileImage: string}) => {
    const before = commentText.replace(/@\S*$/, `@${u.name} `);
    setCommentText(before);
    setMentionQuery(null);
    setMentionResults([]);
    setMentionIndex(0);
    // focus และวาง cursor ท้ายข้อความหลัง DOM update
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false); // ไปท้าย
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // mention navigation
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
      if (e.key === 'Enter') {
        e.preventDefault();
        const u = mentionResults[mentionIndex];
        if (u) selectMention(u);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const reactions = [
    { name: 'ถูกใจ', icon: ThumbsUp, color: '#3b82f6', bg: '#eff6ff' },
    { name: 'รัก', icon: Heart, color: '#ef4444', bg: '#fef2f2' },
    { name: 'ฮ่าๆ', icon: Laugh, color: '#f59e0b', bg: '#fffbeb' },
    { name: 'เฉยๆ', icon: Annoyed, color: '#f97316', bg: '#fff7ed' },
    { name: 'เศร้า', icon: Frown, color: '#a855f7', bg: '#faf5ff' },
    { name: 'โกรธ', icon: Angry, color: '#b91c1c', bg: '#fef2f2' },
  ];

  const handleReactionToggle = (reactionName: string) => {
    setReactionsCount(prev => {
      const newCount = { ...prev };
      if (selectedReaction === reactionName) {
        newCount[reactionName] = (newCount[reactionName] || 1) - 1;
        setSelectedReaction(null);
        setReactedUsers(prevUsers => ({
          ...prevUsers,
          [reactionName]: (prevUsers[reactionName] || []).filter(n => n !== Global.user.name),
        }));
        onReact?.(null);
      } else {
        if (selectedReaction) {
          newCount[selectedReaction] = (newCount[selectedReaction] || 1) - 1;
          setReactedUsers(prevUsers => ({
            ...prevUsers,
            [selectedReaction]: (prevUsers[selectedReaction] || []).filter(n => n !== Global.user.name),
          }));
        }
        newCount[reactionName] = (newCount[reactionName] || 0) + 1;
        setSelectedReaction(reactionName);
        setReactedUsers(prevUsers => ({
          ...prevUsers,
          [reactionName]: [...(prevUsers[reactionName] || []), Global.user.name],
        }));
        onReact?.(reactionName);
      }
      return newCount;
    });
  };

  const totalReactions = Object.values(reactionsCount).reduce((acc, c) => acc + (c ?? 0), 0);
  const activeReactions = Object.keys(reactionsCount)
    .filter(name => (reactionsCount[name] ?? 0) > 0)
    .map(name => reactions.find(r => r.name === name))
    .filter((r): r is (typeof reactions)[0] => !!r);

  const currentReaction = reactions.find(r => r.name === selectedReaction);

  return (
    <motion.div
      initial={disableAnimation ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 hover:shadow-md transition-shadow duration-300"
    >
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 cursor-pointer ring-2 ring-transparent hover:ring-[#5B65F2]/30 transition-all"
            onClick={onUserClick}
          >
            <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-x-1.5">
              <span
                className="font-bold text-gray-900 cursor-pointer hover:text-[#5B65F2] transition-colors text-[15px]"
                onClick={onUserClick}
              >
                {user.name}
              </span>
              {feeling && (
                <span className="text-gray-400 text-sm">
                  กำลังรู้สึก <span className="text-gray-600 font-medium">{feeling}</span>
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(createdAt)}</div>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowPostMenu(!showPostMenu)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <MoreHorizontal size={18} />
          </button>
          <AnimatePresence>
            {showPostMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPostMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20"
                >
                  {user.id === Global.user.id && (
                    <button
                      onClick={() => {
                        setShowPostMenu(false);
                        modal.confirm(
                          'ต้องการลบโพสต์นี้ใช่หรือไม่?',
                          () => { if (postId) net.deletePost(Number(postId)); },
                          'ลบโพสต์'
                        );
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X size={14} /> ลบโพสต์
                    </button>
                  )}
                  <button
                    onClick={() => { setShowPostMenu(false); setShowReportModal(true); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Flag size={14} /> รายงาน
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Post Content */}
      <div>
        {postText && (
          <div className="px-4 pb-3 text-gray-800 text-[15px] leading-relaxed whitespace-pre-wrap">
            <EmojiText text={postText} />
          </div>
        )}
        {postVideoUrl && (
          <div className="w-full aspect-video">
            <VideoPlayer src={postVideoUrl} autoPlay={false} />
          </div>
        )}
        {postImageUrl && !postVideoUrl && (
          <img src={postImageUrl} alt="Post" className="w-full h-auto object-cover max-h-[500px]" />
        )}
        {stickerUrl && (
          <div className="px-4 pb-3 flex justify-center">
            <img src={stickerUrl} alt="Sticker" className="w-36 h-36 object-contain" />
          </div>
        )}
        <SharedPost post={sharedPost} onUserClick={onCommentUserClick} />
      </div>

      {/* Reaction Summary */}
      {totalReactions > 0 && (
        <div className="px-4 py-2 flex items-center border-t border-gray-50">
          <div className="flex -space-x-1 mr-2">
            {activeReactions.map((reaction, idx) => {
              const Icon = reaction.icon;
              return (
                <div
                  key={reaction.name}
                  className="w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                  style={{ backgroundColor: reaction.bg, zIndex: 10 - idx }}
                  onMouseEnter={(e) => {
                    if (window.innerWidth > 768) {
                      const popupData = activeReactions
                        .map(r => ({ type: r.name, color: r.color, users: reactedUsers[r.name] ?? [] }))
                        .filter(d => d.users.length > 0);
                      if (popupData.length > 0) {
                        setLikedByPopupData(popupData);
                        setLikedByPopupPosition({ x: e.clientX, y: e.clientY });
                        setShowLikedByPopup(true);
                      }
                    }
                  }}
                  onMouseMove={(e) => {
                    if (window.innerWidth > 768) setLikedByPopupPosition({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => { if (window.innerWidth > 768) setShowLikedByPopup(false); }}
                >
                  <Icon size={11} fill={reaction.color} stroke="#000" />
                </div>
              );
            })}
          </div>
          <span className="text-xs text-gray-500 hover:underline cursor-pointer">
            {totalReactions === 1 ? Object.values(reactedUsers).flat()[0] : `${totalReactions} คน`}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-2 py-1 border-t border-gray-100 flex items-center justify-between">
        {/* Like Button with Reaction Picker */}
        <div
          className="relative flex-1"
          onMouseEnter={() => {
            if (window.innerWidth > 768) {
              if (reactionPickerTimeoutRef.current) clearTimeout(reactionPickerTimeoutRef.current);
              setShowReactionPicker(true);
            }
          }}
          onMouseLeave={() => {
            if (window.innerWidth > 768) {
              reactionPickerTimeoutRef.current = setTimeout(() => setShowReactionPicker(false), 400);
            }
          }}
        >
          <AnimatePresence>
            {showReactionPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute bottom-full left-0 mb-2 px-2 py-1.5 bg-white rounded-2xl shadow-xl flex space-x-1 z-20 border border-gray-100"
              >
                {reactions.map((reaction) => {
                  const Icon = reaction.icon;
                  const isActive = selectedReaction === reaction.name;
                  return (
                    <button
                      key={reaction.name}
                      title={reaction.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReactionToggle(reaction.name);
                        setShowReactionPicker(false);
                      }}
                      className={`p-2 rounded-full transition-all hover:scale-125 active:scale-110 ${isActive ? 'scale-110' : ''}`}
                      style={{ backgroundColor: isActive ? reaction.bg : 'transparent' }}
                    >
                      <Icon
                        size={22}
                        fill={isActive ? reaction.color : 'none'}
                        stroke='#000'
                        strokeWidth={1.5}
                      />
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            className={`w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl transition-colors text-sm font-semibold ${
              selectedReaction ? 'text-[#5B65F2]' : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => {
              if (window.innerWidth <= 768) setShowReactionPicker(!showReactionPicker);
              else handleReactionToggle('ถูกใจ');
            }}
          >
            {currentReaction ? (
              <currentReaction.icon size={18} fill={currentReaction.color} stroke="#000" strokeWidth={1.5} />
            ) : (
              <ThumbsUp size={18} />
            )}
            <span>{selectedReaction || 'ถูกใจ'}</span>
          </button>
        </div>

        <button
          onClick={() => inputRef.current?.focus()}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors text-sm font-semibold"
        >
          <MessageCircle size={18} />
          <span>แสดงความเห็น</span>
        </button>

        <button
          onClick={onShare}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors text-sm font-semibold"
        >
          <Share2 size={18} />
          <span>แชร์</span>
        </button>

        <button
          onClick={() => {
            const next = !bookmarked;
            setBookmarked(next);
            onBookmark?.(next);
          }}
          className={`flex items-center justify-center py-2 px-3 rounded-xl transition-colors text-sm font-semibold ${
            bookmarked ? 'text-[#5B65F2]' : 'text-gray-500 hover:bg-gray-50'
          }`}
          title={bookmarked ? 'ยกเลิกบันทึก' : 'บันทึกโพสต์'}
        >
          <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Comments */}
      {comments.length > 0 && (
        <div className="px-4 py-3 space-y-2.5 border-t border-gray-50">
          <AnimatePresence>
            {comments
              .filter(c => !c.replyTo) // แสดงเฉพาะ top-level
              .map((comment) => {
                const replies = comments.filter(c => c.replyTo === comment.id);
                return (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    replies={replies}
                    onCommentUserClick={onCommentUserClick}
                    onReply={(c) => { setReplyTo(c); inputRef.current?.focus(); }}
                    comments={comments}
                    onComment={onComment}
                    currentUser={{ id: Global.user.id, name: Global.user.name, profileImage: Global.user.profileImage }}
                  />
                );
              })}
          </AnimatePresence>
        </div>
      )}
      {/* Comment Input */}
      <CommentInput
        currentUser={{ id: Global.user.id, name: Global.user.name, profileImage: Global.user.profileImage }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSubmit={(text, img, sticker, replyToId) => {
          onComment?.(text, img, sticker, replyToId);
        }}
        mentionUsers={comments.map(c => c.user)}
      />

      {/* Liked By Popup */}
      {showLikedByPopup && (
        <div
          className="fixed glass-dark text-white text-[11px] py-2.5 px-3 rounded-2xl shadow-2xl z-[9999] pointer-events-none min-w-[130px]"
          style={{ left: likedByPopupPosition.x, top: likedByPopupPosition.y - 12, transform: 'translate(-50%, -100%)' }}
        >
          <div className="flex flex-col gap-2">
            {likedByPopupData.map((data, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 border-b border-white/10 pb-1">
                  <span className="font-bold" style={{ color: data.color }}>{data.type}</span>
                  <span className="text-[10px] opacity-50">({data.users.length})</span>
                </div>
                <div className="flex flex-col gap-0.5 pl-1">
                  {data.users.slice(0, 5).map((name, uIdx) => (
                    <div key={uIdx} className="whitespace-nowrap opacity-90">{name}</div>
                  ))}
                  {data.users.length > 5 && (
                    <div className="whitespace-nowrap opacity-50 italic">+{data.users.length - 5} คน</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-black/40" />
        </div>
      )}

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <Flag size={18} className="text-red-500" />
                <span className="font-bold text-gray-900">รายงานโพสต์</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">เลือกเหตุผลที่รายงาน</p>
              <div className="space-y-2 mb-4">
                {['เนื้อหาไม่เหมาะสม', 'สแปมหรือโฆษณา', 'ข้อมูลเท็จ', 'การคุกคามหรือการกลั่นแกล้ง', 'อื่นๆ'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors border ${
                      reportReason === reason
                        ? 'bg-red-50 border-red-200 text-red-700 font-medium'
                        : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
                {reportReason === 'อื่นๆ' && (
                  <textarea
                    autoFocus
                    value={reportCustomText}
                    onChange={e => setReportCustomText(e.target.value)}
                    placeholder="ระบุเหตุผล..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-red-200 rounded-xl bg-red-50/50 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none text-gray-700 placeholder-gray-400"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowReportModal(false); setReportReason(''); setReportCustomText(''); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  disabled={!reportReason || (reportReason === 'อื่นๆ' && !reportCustomText.trim())}
                  onClick={() => {
                    if (postId && reportReason) {
                      const finalReason = reportReason === 'อื่นๆ' ? `อื่นๆ: ${reportCustomText.trim()}` : reportReason;
                      net.reportPost(Number(postId), finalReason);
                      setShowReportModal(false);
                      setReportReason('');
                      setReportCustomText('');
                      modal.alert('ส่งรายงานเรียบร้อยแล้ว ขอบคุณที่แจ้งให้เราทราบ');
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ส่งรายงาน
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
