import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';

interface SearchResult {
  id: string;
  name: string;
  nickname: string;
  profileImage: string;
}

interface SearchBoxProps {
  onUserClick?: (user: SearchResult) => void;
}

function SearchBox({ onUserClick }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = net.on(PacketSC.SEARCH_RESULTS, (packet: Packet) => {
      const data = JSON.parse(packet.readString()) as SearchResult[];
      setResults(data);
      setOpen(data.length > 0);
    });
    return () => unsub();
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length >= 2) {
      timerRef.current = setTimeout(() => net.searchUsers(val), 300);
    } else {
      setResults([]);
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full max-w-2xl">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search size={15} className="text-white/50" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="ค้นหา..."
        className="w-full h-9 bg-white/15 hover:bg-white/20 focus:bg-white/25 rounded-full pl-9 pr-8 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
          className="absolute inset-y-0 right-3 flex items-center text-white/50 hover:text-white"
        >
          <X size={14} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[200]"
          >
            {results.map(u => (
              <button
                key={u.id}
                onMouseDown={() => {
                  onUserClick?.(u);
                  setQuery('');
                  setResults([]);
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 w-full text-left transition-colors border-b border-gray-50 last:border-0"
              >
                <img
                  src={u.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{u.name}</div>
                  {u.nickname && <div className="text-xs text-gray-400">{u.nickname}</div>}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SearchBox;
