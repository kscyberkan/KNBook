import React, { useEffect, useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight, MessageCircle, Heart, Flag, Eye, RotateCcw } from 'lucide-react';
import { modal } from '../../components/Modal';
import PostDetailModal from '../components/PostDetailModal';

interface Post {
  id: number; text: string | null; imageUrl: string | null; videoUrl: string | null;
  isActive: boolean; createdAt: string;
  user: { id: number; name: string; profileImage: string | null };
  _count: { reactions: number; comments: number; reports: number };
}

interface Props { api: (path: string, opts?: RequestInit) => Promise<Response>; }

export default function PostsPage({ api }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const fetchPosts = async (p = page) => {
    setLoading(true);
    const res = await api(`/posts?page=${p}`);
    const data = await res.json();
    setPosts(data.posts); setTotal(data.total); setPages(data.pages);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(page); }, [page]);

  const deletePost = (post: Post, e: React.MouseEvent) => {
    e.stopPropagation();
    modal.confirm(`ต้องการลบโพสต์ของ "${post.user.name}" ใช่หรือไม่?`, async () => {
      await api('/posts/delete', { method: 'POST', body: JSON.stringify({ postId: post.id }) });
      fetchPosts(page);
    }, 'ลบโพสต์');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-400">โพสต์ทั้งหมด <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> รายการ · คลิกเพื่อดูรายละเอียด</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {posts.map(post => (
              <div
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors cursor-pointer group"
              >
                <img
                  src={post.user.profileImage ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.name}`}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{post.user.name}</span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(post.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {!post.isActive && (
                      <span className="text-[11px] text-gray-500 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">ถูกลบแล้ว</span>
                    )}
                    {post._count.reports > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded-full">
                        <Flag size={10} /> {post._count.reports} รายงาน
                      </span>
                    )}
                  </div>
                  {post.text && (
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{post.text}</p>
                  )}
                  {post.imageUrl && (
                    <img src={post.imageUrl} className="mt-2 h-20 w-auto rounded-lg object-cover" />
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Heart size={11} /> {post._count.reactions}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={11} /> {post._count.comments}</span>
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-[#5B65F2]">
                      <Eye size={11} /> ดูรายละเอียด
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!post.isActive ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); modal.confirm(`กู้คืนโพสต์ของ "${post.user.name}" ใช่หรือไม่?`, async () => { await api('/posts/restore', { method: 'POST', body: JSON.stringify({ postId: post.id }) }); fetchPosts(page); }, 'กู้คืน'); }}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="กู้คืนโพสต์"
                    >
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => deletePost(post, e)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="ลบโพสต์"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">หน้า {page} / {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <PostDetailModal
        postId={selectedPostId}
        api={api}
        onClose={() => setSelectedPostId(null)}
        onDeleted={() => fetchPosts(page)}
      />
    </div>
  );
}
