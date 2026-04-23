import React, { useEffect, useState } from 'react';
import { X, Heart, MessageCircle, Flag, Trash2, Reply } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modal } from '../../components/Modal';

interface Comment {
  id: number; text: string | null; imageUrl: string | null; stickerUrl: string | null;
  createdAt: string; replyToId: number | null;
  user: { id: number; name: string; profileImage: string | null };
}

interface PostDetail {
  id: number; text: string | null; imageUrl: string | null; videoUrl: string | null;
  feeling: string | null; createdAt: string;
  user: { id: number; name: string; profileImage: string | null };
  reactions: { type: string; user: { name: string } }[];
  comments: Comment[];
  reports: { id: number; reason: string; createdAt: string; user: { id: number; name: string } }[];
  _count: { reactions: number; comments: number; reports: number };
}

interface Props {
  postId: number | null;
  api: (path: string, opts?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onDeleted: () => void;
}

export default function PostDetailModal({ postId, api, onClose, onDeleted }: Props) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'comments' | 'reactions' | 'reports'>('comments');

  useEffect(() => {
    if (!postId) { setPost(null); return; }
    setLoading(true);
    api(`/posts/${postId}`).then(r => r.json()).then(setPost).finally(() => setLoading(false));
  }, [postId]);

  const handleDelete = () => {
    if (!post) return;
    modal.confirm(`ลบโพสต์ของ "${post.user.name}" ใช่หรือไม่?`, async () => {
      await api('/posts/delete', { method: 'POST', body: JSON.stringify({ postId: post.id }) });
      onDeleted();
      onClose();
    }, 'ลบโพสต์');
  };

  // group reactions by type
  const reactionGroups = post ? Object.entries(
    post.reactions.reduce((acc, r) => {
      acc[r.type] = acc[r.type] ?? [];
      acc[r.type].push(r.user.name);
      return acc;
    }, {} as Record<string, string[]>)
  ) : [];

  return (
    <AnimatePresence>
      {postId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.93, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <span className="font-bold text-gray-900">รายละเอียดโพสต์</span>
              <div className="flex items-center gap-2">
                <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors">
                  <Trash2 size={13} /> ลบโพสต์
                </button>
                <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center flex-1 py-16">
                <div className="w-7 h-7 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
              </div>
            ) : post ? (
              <div className="flex-1 overflow-y-auto">
                {/* Post content */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={post.user.profileImage ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.name}`}
                      className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{post.user.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(post.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {post.feeling && <span className="ml-2">กำลังรู้สึก {post.feeling}</span>}
                      </div>
                    </div>
                  </div>
                  {post.text && <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{post.text}</p>}
                  {post.imageUrl && <img src={post.imageUrl} className="rounded-xl max-h-64 object-cover w-full" />}
                  {post.videoUrl && <video src={post.videoUrl} controls className="rounded-xl max-h-64 w-full" />}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Heart size={12} /> {post._count.reactions} reactions</span>
                    <span className="flex items-center gap-1"><MessageCircle size={12} /> {post._count.comments} comments</span>
                    {post._count.reports > 0 && (
                      <span className="flex items-center gap-1 text-red-500"><Flag size={12} /> {post._count.reports} reports</span>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-5 flex-shrink-0">
                  {([
                    { id: 'comments', label: `ความคิดเห็น (${post._count.comments})` },
                    { id: 'reactions', label: `Reactions (${post._count.reactions})` },
                    { id: 'reports', label: `รายงาน (${post._count.reports})`, red: post._count.reports > 0 },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                        tab === t.id
                          ? t.red ? 'border-red-500 text-red-600' : 'border-[#5B65F2] text-[#5B65F2]'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="p-4">
                  {tab === 'comments' && (
                    <div className="space-y-3">
                      {post.comments.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">ยังไม่มีความคิดเห็น</p>
                      ) : post.comments.map(c => (
                        <div key={c.id} className={`flex items-start gap-2.5 ${c.replyToId ? 'ml-8' : ''}`}>
                          {c.replyToId && <Reply size={12} className="text-gray-300 mt-2 flex-shrink-0" />}
                          <img src={c.user.profileImage ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user.name}`}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-900">{c.user.name}</span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(c.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {c.text && <p className="text-xs text-gray-700 mt-0.5">{c.text}</p>}
                            {c.imageUrl && <img src={c.imageUrl} className="mt-1.5 max-h-24 rounded-lg object-cover" />}
                            {c.stickerUrl && <img src={c.stickerUrl} className="mt-1.5 w-12 h-12 object-contain" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === 'reactions' && (
                    <div className="space-y-2">
                      {reactionGroups.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">ยังไม่มี reaction</p>
                      ) : reactionGroups.map(([type, users]) => (
                        <div key={type} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="text-lg">{type}</span>
                          <div>
                            <div className="text-xs font-semibold text-gray-700">{type} · {users.length} คน</div>
                            <div className="text-xs text-gray-400 mt-0.5">{users.slice(0, 10).join(', ')}{users.length > 10 ? ` และอีก ${users.length - 10} คน` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === 'reports' && (
                    <div className="space-y-2">
                      {post.reports.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">ไม่มีรายงาน</p>
                      ) : post.reports.map(r => (
                        <div key={r.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                          <Flag size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-gray-800">{r.user.name}</div>
                            <div className="text-xs text-red-600 mt-0.5">{r.reason}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(r.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 py-16 text-gray-400 text-sm">ไม่พบโพสต์</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
