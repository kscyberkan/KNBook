import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Feed from './Feed';
import Profile from './Profile';
import EditProfile from './EditProfile';
import Bookmarks from './Bookmarks';
import { MessageCircle, X, LogOut, User as UserIcon, ChevronDown, Home, Bell, Settings, Users, Bookmark } from "lucide-react";
import SearchBox from "../components/SearchBox";
import { Global } from "../Global";
import { type User } from "../../types";
import { ChatWindow } from "../components/ChatWindow";
import { motion, AnimatePresence } from "framer-motion";
import { lineAuth } from "../auth/line-auth";
import { googleAuth } from "../auth/google-auth";
import net, { PacketSC } from "../network/client";
import Packet from "../network/packet";
import auth from "../auth/function";
import { modal } from "../../components/Modal";
import { FriendsPanel } from "../components/FriendsPanel";
import { PostModal } from "../components/PostModal";
import { CallWindow, AnswerCallWindow, IncomingCallModal } from "../components/CallWindow";
import { useDictionary } from "../../utils/dictionary";

export type PageType = 'feed' | 'profile' | 'edit-profile' | 'bookmarks';

type NotificationType = 'post' | 'reaction' | 'share' | 'comment' | 'message' | 'friend_request';

interface Notification {
  id: string;
  type: NotificationType;
  user: string;
  users?: string[]; // สำหรับ grouped notifications
  avatar: string;
  message: string;
  time: string;
  read: boolean;
  fromId?: number;
  refId?: number;
  friendHandled?: boolean;
}

/** ยุบ comment/reaction notifications ที่มี refId เดียวกันเป็นอันเดียว */
function groupNotifications(notifs: Notification[]): Notification[] {
  const result: Notification[] = [];
  const grouped = new Map<string, Notification>(); // key = `type:refId`

  for (const n of notifs) {
    if ((n.type === 'comment' || n.type === 'reaction') && n.refId) {
      const key = `${n.type}:${n.refId}`;
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        const users = existing.users ?? [existing.user];
        if (!users.includes(n.user)) users.push(n.user);
        existing.users = users;
        existing.user = users[0]!;
        // เก็บ id ของอันล่าสุด (newest = first in array since sorted desc)
      } else {
        const g = { ...n, users: [n.user] };
        grouped.set(key, g);
        result.push(g);
      }
    } else {
      result.push(n);
    }
  }
  return result;
}

const notificationIcon: Record<NotificationType, string> = {
  post: '📝',
  reaction: '❤️',
  share: '🔁',
  comment: '💬',
  message: '✉️',
  friend_request: '👤',
};

function formatTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'เมื่อกี้';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days === 1) return 'เมื่อวาน';
  return `${days} วันที่แล้ว`;
}

export default function PageManager() {
  const [currentPage, setCurrentPage] = useState<PageType>('feed');
  const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState<(User & { status: string })[]>([]);
  const [activeChat, setActiveChat] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadPerUser, setUnreadPerUser] = useState<Record<string, number>>({});
  const [activeCall, setActiveCall] = useState<{ friend: User; callType: 'audio' | 'video'; stream: MediaStream } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ fromId: number; fromName: string; fromAvatar: string; callType: 'audio' | 'video'; sdp: string } | null>(null);
  const [answerCall, setAnswerCall] = useState<{ fromId: number; fromName: string; fromAvatar: string; callType: 'audio' | 'video'; sdp: string; stream: MediaStream } | null>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const { t } = useDictionary();

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [currentPage, selectedUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    // โหลด notifications จาก server
    net.getNotifications();
    net.getFriends();

    const unsubNotifs = net.on(PacketSC.NOTIFICATION_LIST, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as Array<{
        id: number; type: string; fromName: string; fromImage: string | null;
        fromId: number | null; refId: number | null;
        message: string; read: boolean; handled: boolean; createdAt: string;
      }>;
      setNotifications(groupNotifications(data.map(n => ({
        id: String(n.id),
        type: n.type as NotificationType,
        user: n.fromName,
        avatar: n.fromImage ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${n.fromName}`,
        message: n.message,
        time: formatTime(n.createdAt),
        read: n.read,
        fromId: n.fromId ?? undefined,
        refId: n.refId ?? undefined,
        friendHandled: n.handled,
      }))));
    });

    const unsubFriends = net.on(PacketSC.FRIEND_LIST, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as { id: string; name: string; profileImage: string | null; online?: boolean }[];
      setFriends(data.map(f => ({ ...f, profileImage: f.profileImage ?? '', status: f.online ? 'online' : 'offline' })));
    });

    const unsubOnline = net.on(PacketSC.FRIEND_ONLINE, (packet: Packet) => {
      const userId = String(packet.readInt());
      const online = packet.readBool();
      setFriends(prev => prev.map(f => f.id === userId ? { ...f, status: online ? 'online' : 'offline' } : f));
    });

    // รับแจ้งเตือนเมื่อคำขอเพื่อนถูกยอมรับ — reload friends list
    const unsubAccepted = net.on(PacketSC.FRIEND_UPDATE, (_packet: Packet) => {
      net.getFriends();
    });

    // รับ notification ใหม่ real-time
    const unsubNew = net.on(PacketSC.NEW_NOTIFICATION, (packet: Packet) => {
      const n = JSON.parse(packet.readString()) as {
        id: number; type: string; fromName: string; fromImage: string | null;
        fromId: number | null; refId: number | null; message: string; createdAt: string;
      };
      const newNotif: Notification = {
        id: String(n.id),
        type: n.type as NotificationType,
        user: n.fromName,
        avatar: n.fromImage ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${n.fromName}`,
        message: n.message,
        time: t('common.justNow'),
        read: false,
        fromId: n.fromId ?? undefined,
        refId: n.refId ?? undefined,
      };

      setNotifications(prev => {
        if ((newNotif.type === 'comment' || newNotif.type === 'reaction') && newNotif.refId) {
          const idx = prev.findIndex(p => p.type === newNotif.type && p.refId === newNotif.refId);
          if (idx !== -1) {
            // merge เข้า group เดิม
            const updated = [...prev];
            const existing = { ...updated[idx] } as Notification;
            const users = existing.users ?? [existing.user];
            if (!users.includes(newNotif.user)) users.unshift(newNotif.user);
            existing.users = users;
            existing.user = users[0]!;
            existing.read = false;
            existing.time = 'เมื่อกี้';
            existing.id = newNotif.id;
            updated[idx] = existing;
            updated.splice(idx, 1);
            return [existing, ...updated] as Notification[];
          }
        }
        return [{ ...newNotif, users: [newNotif.user] }, ...prev];
      });
    });

    // โหลด unread messages ตอน mount
    const unsubUnread = net.on(PacketSC.UNREAD_MESSAGES, (packet: Packet) => {
      const rows = JSON.parse(packet.readString()) as { senderId: string; count: number }[];
      const map: Record<string, number> = {};
      let total = 0;
      rows.forEach(r => { map[r.senderId] = r.count; total += r.count; });
      setUnreadPerUser(map);
      setUnreadMessages(total);
    });
    net.getUnreadMessages();

    // incoming call
    const unsubCall = net.on(PacketSC.CALL_INCOMING, (packet: Packet) => {
      const fromId = packet.readInt();
      const callType = packet.readString() as 'audio' | 'video';
      const sdp = packet.readString();
      const caller = friends.find(f => f.id === String(fromId));
      setIncomingCall({
        fromId, callType, sdp,
        fromName: caller?.name ?? `User #${fromId}`,
        fromAvatar: caller?.profileImage ?? '',
      });
    });

    // นับข้อความที่ยังไม่ได้อ่าน
    const unsubMsg = net.on(PacketSC.NEW_MESSAGE, (packet: Packet) => {
      const msg = JSON.parse(packet.readString()) as { senderId: string };
      // ไม่นับถ้าตัวเองเป็นคนส่ง
      if (msg.senderId === Global.user.id) return;
      setActiveChat(current => {
        if (!current || current.id !== msg.senderId) {
          setUnreadMessages(prev => prev + 1);
          setUnreadPerUser(prev => ({ ...prev, [msg.senderId]: (prev[msg.senderId] ?? 0) + 1 }));
        }
        return current;
      });
    });

    return () => { unsubNotifs(); unsubNew(); unsubFriends(); unsubOnline(); unsubAccepted(); unsubUnread(); unsubCall(); unsubMsg(); };
  }, []);

  const markAllRead = () => {
    net.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearUnreadForUser = (userId: string) => {
    setUnreadPerUser(prev => {
      const next = { ...prev };
      delete next[userId];
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      setUnreadMessages(total);
      return next;
    });
  };

  const markOneRead = (id: string) => {
    net.markNotificationRead(Number(id));
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const navigateToProfile = (user?: User) => {
    if (user && user.id && !user.bio && !user.province) {
      net.getUserById(Number(user.id));
      const unsub = net.on(PacketSC.USER_DATA, (packet: Packet) => {
        const data = JSON.parse(packet.readString()) as User;
        unsub();
        setSelectedUser(data);
        setCurrentPage('profile');
        setShowUserMenu(false);
      });
    } else {
      setSelectedUser(user);
      setCurrentPage('profile');
      setShowUserMenu(false);
    }
  };

  const navigateToEditProfile = () => {
    setCurrentPage('edit-profile');
    setShowUserMenu(false);
  };

  const handleLogout = () => {
    modal.confirm(
      'คุณต้องการออกจากระบบใช่หรือไม่?',
      () => {
        auth.removeLoginData();
        lineAuth.logout();
        googleAuth.logout();
      },
      'ออกจากระบบ'
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'feed':
        return <Feed onUserClick={navigateToProfile} onSharePost={() => navigateToProfile(undefined)} />;
      case 'profile':
        return <Profile user={selectedUser} onEditClick={navigateToEditProfile} onSharePost={() => navigateToProfile(undefined)} onUserClick={navigateToProfile} />;
      case 'edit-profile':
        return <EditProfile onBack={() => setCurrentPage('profile')} />;
      case 'bookmarks':
        return <Bookmarks onUserClick={navigateToProfile} onBack={() => setCurrentPage('feed')} />;
      default:
        return <Feed onUserClick={navigateToProfile} onSharePost={() => navigateToProfile(undefined)} />;
    }
  };

  const navItems = [
    { id: 'feed', icon: Home, label: 'หน้าแรก', onClick: () => setCurrentPage('feed') },
    { id: 'profile', icon: UserIcon, label: 'โปรไฟล์', onClick: () => navigateToProfile(undefined) },
    { id: 'bookmarks', icon: Bookmark, label: 'บันทึก', onClick: () => setCurrentPage('bookmarks') },
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans">
      {/* Header (Shared across pages) */}
      <header className="bg-gradient-to-r from-[#5B65F2] to-[#7B83F5] text-white sticky top-0 z-50 h-[60px] flex items-center shadow-lg shadow-[#5B65F2]/20">
        <div className="w-full flex items-center px-4 gap-2 md:gap-4 max-w-[1440px] mx-auto">
          {/* Logo KN */}
          <div
            onClick={() => setCurrentPage('feed')}
            className="text-2xl md:text-3xl font-black cursor-pointer hover:opacity-90 transition-opacity flex-shrink-0 tracking-tight"
          >
            KN
          </div>

          {/* Navigation Tabs (Desktop) */}
          <div className="hidden md:flex flex-1 justify-center max-w-md mx-auto">
            <div className="flex gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className={`relative flex flex-col items-center justify-center w-24 h-[60px] transition-colors hover:bg-white/10 group ${isActive ? 'text-white' : 'text-white/60'
                      }`}
                  >
                    <Icon size={24} className={isActive ? 'scale-110' : ''} />
                    {isActive && (
                      <motion.div
                        layoutId="nav-underline"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Box (Centered on Mobile, beside Nav on Desktop) */}
          <div className="flex-1 md:flex-initial md:w-64">
            <SearchBox onUserClick={(u) => navigateToProfile({ id: u.id, name: u.name, profileImage: u.profileImage })} />
          </div>

          {/* User Profile & Menu */}
          <div className="flex items-center space-x-1 md:space-x-2">
            <div className="hidden lg:flex items-center space-x-1 mr-2">
              <div className="relative">
                <button
                  onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); setShowFriendsPanel(false); }}
                  className={`p-2 hover:bg-white/10 rounded-full transition-colors relative ${showNotifications ? 'bg-white/20' : ''}`}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[70]"
                      >
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                          <span className="font-bold text-gray-900 text-sm">การแจ้งเตือน</span>
                          {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-[#5B65F2] hover:text-[#4a54e1] font-semibold transition-colors">
                              อ่านทั้งหมด
                            </button>
                          )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => {
                                markOneRead(notif.id);
                                setShowNotifications(false);
                                // navigate ตาม type
                                if (notif.type === 'reaction' || notif.type === 'comment' || notif.type === 'share' || notif.type === 'post') {
                                  if (notif.refId) setOpenPostId(String(notif.refId));
                                } else if (notif.type === 'message') {
                                  if (notif.fromId) {
                                    const friend = friends.find(f => f.id === String(notif.fromId));
                                    if (friend) {
                                      setActiveChat({ id: friend.id, name: friend.name, profileImage: friend.profileImage });
                                      clearUnreadForUser(friend.id);
                                    } else {
                                      // ไม่อยู่ใน friends list — fetch user data
                                      net.getUserById(notif.fromId);
                                      const unsub = net.on(PacketSC.USER_DATA, (packet: Packet) => {
                                        const data = JSON.parse(packet.readString()) as User;
                                        unsub();
                                        setActiveChat({ id: data.id, name: data.name, profileImage: data.profileImage });
                                        clearUnreadForUser(data.id);
                                      });
                                    }
                                  }
                                } else if (notif.type === 'friend_request') {
                                  setShowFriendsPanel(true);
                                }
                              }}
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${!notif.read ? 'bg-blue-50/40' : ''}`}
                            >
                              <div className="relative flex-shrink-0">
                                <img src={notif.avatar} alt={notif.user} className="w-10 h-10 rounded-full object-cover ring-2 ring-white" />
                                <span className="absolute -bottom-0.5 -right-0.5 text-sm bg-white rounded-full">{notificationIcon[notif.type]}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 leading-snug">
                                  <span className="font-semibold">
                                    {notif.users && notif.users.length > 1
                                      ? `${notif.users[0]} และอีก ${notif.users.length - 1} คน`
                                      : notif.user}
                                  </span>{' '}
                                  <span className="text-gray-600">{notif.message}</span>
                                </p>
                                <p className="text-[11px] text-[#5B65F2] mt-1 font-medium">{notif.time}</p>
                                {notif.type === 'friend_request' && !notif.friendHandled && (
                                  <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        net.handleFriendNotif(Number(notif.id), notif.fromId ?? 0, true);
                                        setNotifications(prev => prev.map(n =>
                                          n.id === notif.id ? { ...n, friendHandled: true, read: true, message: 'ยืนยันคำขอเป็นเพื่อนแล้ว' } : n
                                        ));
                                      }}
                                      className="text-xs bg-[#5B65F2] hover:bg-[#4a54e1] text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                                    >
                                      ยืนยัน
                                    </button>
                                    <button
                                      onClick={() => {
                                        net.handleFriendNotif(Number(notif.id), notif.fromId ?? 0, false);
                                        setNotifications(prev => prev.map(n =>
                                          n.id === notif.id ? { ...n, friendHandled: true, read: true, message: 'ปฏิเสธคำขอแล้ว' } : n
                                        ));
                                      }}
                                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                    >
                                      ปฏิเสธ
                                    </button>
                                  </div>
                                )}
                                {notif.type === 'friend_request' && notif.friendHandled && (
                                  <p className="text-[11px] text-gray-400 mt-1 italic">{notif.message}</p>
                                )}
                              </div>
                              {!notif.read && (
                                <div className="w-2 h-2 bg-[#5B65F2] rounded-full flex-shrink-0 mt-2" />
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button
                  onClick={() => { setShowFriendsPanel(!showFriendsPanel); setShowNotifications(false); setShowUserMenu(false); }}
                  className={`p-2 hover:bg-white/10 rounded-full transition-colors ${showFriendsPanel ? 'bg-white/20' : ''}`}
                >
                  <Users size={20} />
                </button>
                <FriendsPanel
                  open={showFriendsPanel}
                  onClose={() => setShowFriendsPanel(false)}
                  onUserClick={(u) => { navigateToProfile({ id: u.id, name: u.name, profileImage: u.profileImage ?? '' }); setShowFriendsPanel(false); }}
                />
              </div>
              <button
                onClick={() => { setShowFriends(!showFriends); }}
                className={`p-2 hover:bg-white/10 rounded-full transition-colors relative ${showFriends ? 'bg-white/20' : ''}`}
              >
                <MessageCircle size={20} />
                {unreadMessages > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
            </div>

            <div className="relative">
              <div
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 cursor-pointer hover:bg-white/10 px-2 md:px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
              >
                <div className="w-8 h-8 rounded-full border-2 border-white/20 flex-shrink-0 overflow-hidden bg-gray-300 shadow-sm">
                  {Global.user.profileImage ? (
                    <img src={Global.user.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#AAB0F9] flex items-center justify-center text-white text-xs font-bold">
                      {Global.user.name?.[0] ?? '?'}
                    </div>
                  )}
                </div>
                <ChevronDown size={14} className={`hidden md:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </div>

              {/* User Menu Dropdown */}
              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowUserMenu(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[70] py-2"
                    >
                      <div className="px-4 py-3 border-b border-gray-50 mb-1 bg-gradient-to-r from-[#5B65F2]/5 to-transparent">
                        <div className="text-sm font-bold text-gray-900 truncate">{Global.user.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">จัดการบัญชีของคุณ</div>
                      </div>

                      <button
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setCurrentPage('profile');
                          setShowUserMenu(false);
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          <UserIcon size={18} />
                        </div>
                        <span className="font-medium text-gray-800">โปรไฟล์ของคุณ</span>
                      </button>

                      <button
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={navigateToEditProfile}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          <Settings size={18} />
                        </div>
                        <span className="font-medium text-gray-800">ตั้งค่า/แก้ไขโปรไฟล์</span>
                      </button>

                      <button
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                          <LogOut size={18} />
                        </div>
                        <span className="font-medium">ออกจากระบบ</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main ref={mainScrollRef} className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full flex flex-col"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <div className="md:hidden bg-white border-t border-gray-100 h-16 flex items-center justify-center gap-16 px-4 sticky bottom-0 z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center space-y-1 ${isActive ? 'text-[#5B65F2]' : 'text-gray-400'
                }`}
            >
              <Icon size={22} fill={isActive ? "currentColor" : "none"} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Floating Chat System (Always visible) */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100] flex items-end">
        <div className="flex items-end mr-4">
          <AnimatePresence mode="wait">
            {activeChat && (
              <motion.div
                key="chat-window"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="w-[calc(100vw-6rem)] sm:w-[320px] md:w-[360px] h-[450px] md:h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
              >
                <ChatWindow
                  friend={activeChat}
                  onClose={() => setActiveChat(null)}
                  onUserClick={(user) => {
                    navigateToProfile(user);
                    setActiveChat(null);
                  }}
                  onCall={async (callType) => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
                      setActiveCall({ friend: activeChat, callType, stream });
                    } catch (err: any) {
                      console.error('[Call] getUserMedia error:', err?.name, err?.message, err);
                      const msg = err?.name === 'NotAllowedError'
                        ? 'กรุณาอนุญาตการเข้าถึงกล้อง/ไมโครโฟนในการตั้งค่าเบราว์เซอร์'
                        : err?.name === 'NotFoundError'
                        ? 'ไม่พบกล้องหรือไมโครโฟน'
                        : err?.name === 'NotReadableError'
                        ? 'กล้องหรือไมโครโฟนถูกใช้งานโดยแอปอื่นอยู่'
                        : err?.name === 'OverconstrainedError'
                        ? 'กล้องไม่รองรับความละเอียดที่ต้องการ'
                        : `ไม่สามารถเข้าถึงได้: ${err?.name} - ${err?.message ?? err}`;
                      modal.error(msg);
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showFriends && (
              <motion.div
                key="friends-list"
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0 } }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="w-[calc(100vw-6rem)] sm:w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-[#5B65F2] to-[#7B83F5] p-4 text-white font-bold flex justify-between items-center">
                  <span className="text-sm">รายชื่อเพื่อน</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-normal opacity-80">ออนไลน์</span>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {friends.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">ยังไม่มีรายชื่อเพื่อน</div>
                  ) : friends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => {
                        setActiveChat({ id: friend.id, name: friend.name, profileImage: friend.profileImage });
                        setShowFriends(false);
                        clearUnreadForUser(friend.id);
                      }}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <div className="relative">
                        <img src={friend.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} alt={friend.name} className="w-10 h-10 rounded-full object-cover" />
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        {(unreadPerUser[friend.id] ?? 0) > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                            {(unreadPerUser[friend.id] ?? 0) > 9 ? '9+' : unreadPerUser[friend.id]}
                          </span>
                        )}
                      </div>
                      <div className="ml-3 flex-1">
                        <div className={`text-sm font-bold ${(unreadPerUser[friend.id] ?? 0) > 0 ? 'text-gray-900' : 'text-gray-800'}`}>{friend.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {(unreadPerUser[friend.id] ?? 0) > 0
                            ? <span className="text-red-500 font-medium">{unreadPerUser[friend.id]} ข้อความใหม่</span>
                            : friend.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}
                        </div>
                      </div>
                      <MessageCircle size={16} className={(unreadPerUser[friend.id] ?? 0) > 0 ? 'text-red-400' : 'text-gray-300'} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => { activeChat ? setActiveChat(null) : setShowFriends(!showFriends); }}
          className={`w-14 h-14 md:w-16 md:h-16 rounded-full shadow-xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 flex-shrink-0 relative ${
            showFriends || activeChat
              ? 'bg-gray-700 rotate-12'
              : 'bg-gradient-to-br from-[#5B65F2] to-[#7B83F5] shadow-[#5B65F2]/30'
          }`}
        >
          {activeChat ? <X size={28} className="text-white" /> : <MessageCircle size={28} className="text-white" />}
          {unreadMessages > 0 && !activeChat && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
        </button>
      </div>
      {/* Post Modal */}
      <PostModal
        postId={openPostId}
        onClose={() => setOpenPostId(null)}
        onUserClick={navigateToProfile}
      />

      {/* Call UI */}
      <AnimatePresence>
        {activeCall && (
          <CallWindow
            friend={activeCall.friend}
            callType={activeCall.callType}
            localStream={activeCall.stream}
            onEnd={() => setActiveCall(null)}
          />
        )}
        {answerCall && (
          <AnswerCallWindow
            fromId={answerCall.fromId}
            fromName={answerCall.fromName}
            fromAvatar={answerCall.fromAvatar}
            callType={answerCall.callType}
            remoteSdp={answerCall.sdp}
            localStream={answerCall.stream}
            onEnd={() => setAnswerCall(null)}
          />
        )}
        {incomingCall && !activeCall && !answerCall && (
          <IncomingCallModal
            call={incomingCall}
            onAccept={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.callType === 'video' });
                setAnswerCall({ ...incomingCall, stream });
                setIncomingCall(null);
              } catch (err: any) {
                const msg = err?.name === 'NotAllowedError'
                  ? 'กรุณาอนุญาตการเข้าถึงกล้อง/ไมโครโฟนในการตั้งค่าเบราว์เซอร์'
                  : err?.name === 'NotFoundError'
                  ? 'ไม่พบกล้องหรือไมโครโฟน'
                  : err?.name === 'NotReadableError'
                  ? 'กล้องหรือไมโครโฟนถูกใช้งานโดยแอปอื่นอยู่'
                  : `ไม่สามารถเข้าถึงได้: ${err?.message ?? err}`;
                modal.error(msg);
                net.sendCallEnd(incomingCall.fromId);
                setIncomingCall(null);
              }
            }}
            onReject={() => {
              net.sendCallEnd(incomingCall.fromId);
              setIncomingCall(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
