import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalType = 'alert' | 'confirm' | 'success' | 'error' | 'warning';

interface ModalOptions {
  title?: string;
  message: string;
  type?: ModalType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ModalState extends ModalOptions {
  id: number;
}

// ─── Global controller ────────────────────────────────────────────────────────

let _show: ((opts: ModalOptions) => void) | null = null;

export const modal = {
  alert(message: string, title?: string) {
    _show?.({ message, title, type: 'alert' });
  },
  success(message: string, title?: string) {
    _show?.({ message, title: title ?? 'สำเร็จ', type: 'success' });
  },
  error(message: string, title?: string) {
    _show?.({ message, title: title ?? 'เกิดข้อผิดพลาด', type: 'error' });
  },
  warning(message: string, title?: string) {
    _show?.({ message, title: title ?? 'คำเตือน', type: 'warning' });
  },
  confirm(message: string, onConfirm: () => void, title?: string, onCancel?: () => void) {
    _show?.({ message, title: title ?? 'ยืนยัน', type: 'confirm', onConfirm, onCancel });
  },
};

// ─── Icon & color map ─────────────────────────────────────────────────────────

const config: Record<ModalType, { icon: React.ReactNode; accent: string; bg: string }> = {
  alert:   { icon: <Info size={22} />,          accent: 'text-[#5B65F2]', bg: 'bg-[#5B65F2]/10' },
  success: { icon: <CheckCircle size={22} />,   accent: 'text-green-600',  bg: 'bg-green-50' },
  error:   { icon: <AlertCircle size={22} />,   accent: 'text-red-500',    bg: 'bg-red-50' },
  warning: { icon: <AlertTriangle size={22} />, accent: 'text-amber-500',  bg: 'bg-amber-50' },
  confirm: { icon: <AlertTriangle size={22} />, accent: 'text-[#5B65F2]', bg: 'bg-[#5B65F2]/10' },
};

// ─── Provider (mount once in App) ─────────────────────────────────────────────

export function ModalProvider() {
  const [stack, setStack] = useState<ModalState[]>([]);

  const show = useCallback((opts: ModalOptions) => {
    setStack(prev => [...prev, { ...opts, id: Date.now() }]);
  }, []);

  // register global controller
  _show = show;

  const close = (id: number) => setStack(prev => prev.filter(m => m.id !== id));

  return (
    <AnimatePresence>
      {stack.map(m => {
        const { icon, accent, bg } = config[m.type ?? 'alert'];
        const isConfirm = m.type === 'confirm';

        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!isConfirm) { m.onCancel?.(); close(m.id); } }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`${bg} px-5 py-4 flex items-center gap-3`}>
                <span className={accent}>{icon}</span>
                <span className={`font-bold text-base ${accent}`}>{m.title ?? 'แจ้งเตือน'}</span>
                {!isConfirm && (
                  <button
                    onClick={() => { m.onCancel?.(); close(m.id); }}
                    className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                <p className="text-gray-700 text-sm leading-relaxed">{m.message}</p>
              </div>

              {/* Footer */}
              <div className={`px-5 pb-4 flex gap-2 ${isConfirm ? 'justify-end' : 'justify-center'}`}>
                {isConfirm && (
                  <button
                    onClick={() => { m.onCancel?.(); close(m.id); }}
                    className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-all"
                  >
                    {m.cancelLabel ?? 'ยกเลิก'}
                  </button>
                )}
                <button
                  onClick={() => { m.onConfirm?.(); close(m.id); }}
                  className={`px-5 py-2 rounded-xl text-white font-semibold text-sm transition-all active:scale-95 ${
                    m.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                    m.type === 'warning' || isConfirm ? 'bg-[#5B65F2] hover:bg-[#4a54e1]' :
                    m.type === 'success' ? 'bg-green-600 hover:bg-green-700' :
                    'bg-[#5B65F2] hover:bg-[#4a54e1]'
                  }`}
                >
                  {m.confirmLabel ?? 'ตกลง'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
