import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { FeedItem } from './FeedItem';
import { type Post, type User } from '../../types';
import net from '../network/client';

interface PostModalProps {
  postId: string | null;
  onClose: () => void;
  onUserClick?: (user: User) => void;
}

export const PostModal: React.FC<PostModalProps> = ({ postId, onClose, onUserClick }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId) { setPost(null); return; }
    setLoading(true);
    fetch(`/api/post/${postId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Post | null) => { setPost(data); setLoading(false); })
      .catch((e) => { console.error('[PostModal] fetch error:', e); setLoading(false); });
  }, [postId]);

  return (
    <AnimatePresence>
      {postId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#F0F2F5] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex-shrink-0 bg-white/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <span className="font-bold text-gray-900">โพสต์</span>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
                </div>
              ) : post ? (
                <FeedItem
                  postId={post.id}
                  user={post.user}
                  onUserClick={() => { onUserClick?.(post.user); onClose(); }}
                  postText={post.text}
                  postImageUrl={post.imageUrl}
                  postVideoUrl={post.videoUrl}
                  feeling={post.feeling}
                  stickerUrl={post.stickerUrl}
                  groupName={post.groupName}
                  sharedPost={post.sharedPost}
                  initialReactionsCount={Object.fromEntries((post.reactions ?? []).map(r => [r.type, r.users.length]))}
                  initialReactedUsers={Object.fromEntries((post.reactions ?? []).map(r => [r.type, r.users]))}
                  initialComments={post.comments}
                  onReact={(type) => {
                    if (type) net.reactPost(Number(post.id), type);
                    else net.unreactPost(Number(post.id));
                  }}
                  onComment={(text, img, sticker, replyToId) =>
                    net.createComment(Number(post.id), text, img, sticker, replyToId ? Number(replyToId) : undefined)
                  }
                  onShare={() => net.createPost({ sharedFromId: Number(post.id) })}
                  onCommentUserClick={(u) => { onUserClick?.(u); onClose(); }}
                />
              ) : (
                <div className="text-center py-16 text-gray-400 text-sm">ไม่พบโพสต์</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
