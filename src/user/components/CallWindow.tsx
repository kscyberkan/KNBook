import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneOff, Video, VideoOff, Mic, MicOff, Phone, Settings, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type User } from '../../types';
import net, { PacketSC } from '../network/client';
import Packet from '../network/packet';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN server สำหรับ NAT traversal (จำเป็นเมื่อใช้ ngrok/proxy)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

const hasMediaDevices = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const media = navigator.mediaDevices;
  return !!(media?.getUserMedia || (navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia);
};

const getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
  if (typeof navigator === 'undefined') {
    throw new Error('navigator unavailable');
  }
  const media = navigator.mediaDevices;
  if (media && typeof media.getUserMedia === 'function') {
    return media.getUserMedia(constraints);
  }
  const navAny = navigator as any;
  const legacyGetUserMedia = navAny.getUserMedia || navAny.webkitGetUserMedia || navAny.mozGetUserMedia;
  if (typeof legacyGetUserMedia === 'function') {
    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject);
    });
  }
  throw new Error('Media devices not supported');
};

const enumerateDevices = async (): Promise<MediaDeviceInfo[]> => {
  if (typeof navigator === 'undefined') {
    return [];
  }
  const media = navigator.mediaDevices;
  if (media && typeof media.enumerateDevices === 'function') {
    return media.enumerateDevices();
  }
  return [];
};

// ─── Device Settings Panel ───────────────────────────────────────────────────

interface DeviceSettingsProps {
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  selectedAudioId: string;
  selectedVideoId: string;
  selectedOutputId: string;
  onAudioChange: (deviceId: string) => void;
  onVideoChange: (deviceId: string) => void;
  onOutputChange: (deviceId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function DeviceSettings({
  audioDevices,
  videoDevices,
  audioOutputDevices,
  selectedAudioId,
  selectedVideoId,
  selectedOutputId,
  onAudioChange,
  onVideoChange,
  onOutputChange,
  isOpen,
  onToggle,
}: DeviceSettingsProps) {
  return (
    <div className="absolute top-4 right-4 z-30">
      <motion.button
        onClick={onToggle}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          isOpen ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white/20 hover:bg-white/30'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Settings size={22} className="text-white" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-16 right-0 bg-gray-900 rounded-2xl shadow-2xl p-4 w-64 border border-white/10"
          >
            {/* Microphone Setting */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">ไมโครโฟน</label>
              <div className="relative">
                <select
                  value={selectedAudioId}
                  onChange={(e) => onAudioChange(e.target.value)}
                  className="w-full appearance-none bg-gray-800 text-white text-sm rounded-lg px-3 py-2 pr-8 border border-gray-700 hover:border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Camera Setting */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">กล้อง</label>
              <div className="relative">
                <select
                  value={selectedVideoId}
                  onChange={(e) => onVideoChange(e.target.value)}
                  className="w-full appearance-none bg-gray-800 text-white text-sm rounded-lg px-3 py-2 pr-8 border border-gray-700 hover:border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Speaker/Audio Output Setting */}
            {audioOutputDevices.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">ลำโพง</label>
                <div className="relative">
                  <select
                    value={selectedOutputId}
                    onChange={(e) => onOutputChange(e.target.value)}
                    className="w-full appearance-none bg-gray-800 text-white text-sm rounded-lg px-3 py-2 pr-8 border border-gray-700 hover:border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {audioOutputDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="mt-3 text-xs text-gray-400 border-t border-gray-700 pt-3">
              ✓ เลือกอุปกรณ์ที่ต้องการใช้ในการโทร
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared call UI ───────────────────────────────────────────────────────────

function CallControls({ micOn, camOn, showCam, onToggleMic, onToggleCam, onEnd, duration, label }:
  { micOn: boolean; camOn: boolean; showCam: boolean; onToggleMic: () => void; onToggleCam: () => void; onEnd: () => void; duration: number; label: string }) {
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (
    <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3 z-20">
      <span className="text-white/60 text-sm">{label}{duration > 0 ? ` · ${fmt(duration)}` : ''}</span>
      <div className="flex items-center gap-5">
        <button onClick={onToggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500'}`}>
          {micOn ? <Mic size={22} className="text-white" /> : <MicOff size={22} className="text-white" />}
        </button>
        {showCam && (
          <button onClick={onToggleCam} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${camOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500'}`}>
            {camOn ? <Video size={22} className="text-white" /> : <VideoOff size={22} className="text-white" />}
          </button>
        )}
        <button onClick={onEnd} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all hover:scale-105">
          <PhoneOff size={26} className="text-white" />
        </button>
      </div>
    </div>
  );
}

// ─── Caller window (outgoing) ─────────────────────────────────────────────────

interface CallerProps {
  friend: User;
  callType: 'audio' | 'video';
  localStream: MediaStream;
  onEnd: () => void;
}

export const CallWindow: React.FC<CallerProps> = ({ friend, callType, localStream, onEnd }) => {
  const [state, setState] = useState<'calling' | 'connected'>('calling');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const streamRef = useRef(localStream);

  // Enumerate devices
  useEffect(() => {
    const getDevices = async () => {
      const devices = await enumerateDevices();
      const audioDevs = devices.filter((d) => d.kind === 'audioinput');
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      const audioOutDevs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioDevices(audioDevs);
      setVideoDevices(videoDevs);
      setAudioOutputDevices(audioOutDevs);
      if (audioDevs.length > 0) setSelectedAudioId(audioDevs[0].deviceId);
      if (videoDevs.length > 0) setSelectedVideoId(videoDevs[0].deviceId);
      if (audioOutDevs.length > 0) setSelectedOutputId(audioOutDevs[0].deviceId);
    };
    getDevices();
    if (hasMediaDevices() && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', getDevices);
      return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }
    return undefined;
  }, []);

  const switchDevice = useCallback(
    async (kind: 'audio' | 'video', deviceId: string) => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : undefined,
          video: kind === 'video' ? { deviceId: { exact: deviceId } } : undefined,
        };
        const newStream = await getUserMedia(constraints);
        const newTrack = newStream.getTracks()[0];
        const oldTrack = streamRef.current
          .getTracks()
          .find((t) => t.kind === kind);

        if (oldTrack && pcRef.current) {
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track?.kind === kind);
          if (sender) await sender.replaceTrack(newTrack);
          oldTrack.stop();
          streamRef.current.removeTrack(oldTrack);
          streamRef.current.addTrack(newTrack);
        }

        if (kind === 'audio') setSelectedAudioId(deviceId);
        else setSelectedVideoId(deviceId);
      } catch (error) {
        console.error(`Error switching ${kind}:`, error);
      }
    },
    []
  );

  const switchOutput = useCallback(async (deviceId: string) => {
    try {
      if (remoteVideoRef.current && 'setSinkId' in remoteVideoRef.current) {
        await (remoteVideoRef.current as any).setSinkId(deviceId);
        setSelectedOutputId(deviceId);
      }
    } catch (error) {
      console.error('Error switching output:', error);
    }
  }, []);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    net.sendCallEnd(Number(friend.id));
    cleanup();
    onEnd();
  }, [friend.id, cleanup, onEnd]);

  useEffect(() => {
    streamRef.current = localStream;
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0] ?? null; };
    pc.onicecandidate = (e) => { if (e.candidate) net.sendCallIce(Number(friend.id), JSON.stringify(e.candidate)); };

    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      net.sendCallOffer(Number(friend.id), callType, offer.sdp ?? '');
    });

    const unsubAnswer = net.on(PacketSC.CALL_ANSWER, async (packet: Packet) => {
      packet.readInt();
      const sdp = packet.readString();
      await pc.setRemoteDescription({ type: 'answer', sdp });
      setState('connected');
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    });
    const unsubIce = net.on(PacketSC.CALL_ICE, async (packet: Packet) => {
      packet.readInt();
      const c = packet.readString();
      try { if (c) await pc.addIceCandidate(JSON.parse(c)); } catch { /* ignore */ }
    });
    const unsubEnd = net.on(PacketSC.CALL_END, () => { cleanup(); onEnd(); });

    return () => { unsubAnswer(); unsubIce(); unsubEnd(); cleanup(); };
  }, []);

  const toggleMic = () => { localStream.getAudioTracks().forEach(t => { t.enabled = !micOn; }); setMicOn(v => !v); };
  const toggleCam = () => { localStream.getVideoTracks().forEach(t => { t.enabled = !camOn; }); setCamOn(v => !v); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="relative w-full max-w-4xl min-h-[88vh] rounded-[32px] border border-white/10 bg-[#08101e]/95 shadow-[0_0_90px_rgba(0,0,0,0.65)] overflow-hidden font-mono text-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#05101a]/95 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
            <span className="text-[0.72rem] uppercase tracking-[0.3em] text-cyan-300">terminal call</span>
          </div>
          <div className="text-xs text-slate-400">{friend.name}</div>
        </div>

        <DeviceSettings
          audioDevices={audioDevices}
          videoDevices={videoDevices}
          audioOutputDevices={audioOutputDevices}
          selectedAudioId={selectedAudioId}
          selectedVideoId={selectedVideoId}
          selectedOutputId={selectedOutputId}
          onAudioChange={(id) => switchDevice('audio', id)}
          onVideoChange={(id) => switchDevice('video', id)}
          onOutputChange={switchOutput}
          isOpen={showSettings}
          onToggle={() => setShowSettings(!showSettings)}
        />

        <div className="relative flex flex-col h-full">
          <div className="flex-1 p-4 sm:p-6">
            {callType === 'video' ? (
              <div className="relative w-full h-full min-h-[320px] rounded-3xl overflow-hidden bg-black/80 border border-white/10">
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/70" />
                <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs text-green-300 uppercase tracking-[0.18em]">
                  {state === 'calling' ? 'Connecting...' : 'Live Video'}
                </div>
                {state === 'calling' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-center px-4 text-sm text-green-200">
                    กำลังโทรหา {friend.name}...
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full min-h-[280px] rounded-3xl border border-white/10 bg-[#06111b] p-6 flex flex-col items-center justify-center gap-3 text-green-300">
                <div className="w-24 h-24 rounded-full border border-white/10 overflow-hidden bg-slate-800">
                  <img src={friend.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} className="w-full h-full object-cover" />
                </div>
                <div className="text-lg font-semibold text-white">{friend.name}</div>
                <div className="text-sm text-slate-400">Voice call</div>
                <div className="w-full rounded-2xl border border-white/10 bg-black/70 p-3 text-left text-sm leading-6 text-green-200">
                  <div>&gt; callType: audio</div>
                  <div>&gt; status: {state === 'calling' ? 'กำลังโทร...' : 'เชื่อมต่อแล้ว'}</div>
                  <div>&gt; duration: {duration > 0 ? `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}` : '00:00'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-5">
            {callType === 'video' && (
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-24 right-4 w-32 h-24 rounded-xl object-cover border-2 border-white/20 z-20 shadow-2xl" />
            )}
            <CallControls micOn={micOn} camOn={camOn} showCam={callType === 'video'} onToggleMic={toggleMic} onToggleCam={toggleCam} onEnd={endCall}
              duration={duration} label={state === 'calling' ? 'กำลังโทร...' : 'กำลังคุย'} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Callee window (incoming) ─────────────────────────────────────────────────

interface CalleeProps {
  fromId: number;
  fromName: string;
  fromAvatar: string;
  callType: 'audio' | 'video';
  remoteSdp: string;
  localStream: MediaStream;
  onEnd: () => void;
}

export const AnswerCallWindow: React.FC<CalleeProps> = ({ fromId, fromName, fromAvatar, callType, remoteSdp, localStream, onEnd }) => {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const streamRef = useRef(localStream);

  // Enumerate devices
  useEffect(() => {
    const getDevices = async () => {
      const devices = await enumerateDevices();
      const audioDevs = devices.filter((d) => d.kind === 'audioinput');
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      const audioOutDevs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioDevices(audioDevs);
      setVideoDevices(videoDevs);
      setAudioOutputDevices(audioOutDevs);
      if (audioDevs.length > 0) setSelectedAudioId(audioDevs[0].deviceId);
      if (videoDevs.length > 0) setSelectedVideoId(videoDevs[0].deviceId);
      if (audioOutDevs.length > 0) setSelectedOutputId(audioOutDevs[0].deviceId);
    };
    getDevices();
    if (hasMediaDevices() && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', getDevices);
      return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }
    return undefined;
  }, []);

  const switchDevice = useCallback(
    async (kind: 'audio' | 'video', deviceId: string) => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : undefined,
          video: kind === 'video' ? { deviceId: { exact: deviceId } } : undefined,
        };
        const newStream = await getUserMedia(constraints);
        const newTrack = newStream.getTracks()[0];
        const oldTrack = streamRef.current
          .getTracks()
          .find((t) => t.kind === kind);

        if (oldTrack && pcRef.current) {
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track?.kind === kind);
          if (sender) await sender.replaceTrack(newTrack);
          oldTrack.stop();
          streamRef.current.removeTrack(oldTrack);
          streamRef.current.addTrack(newTrack);
        }

        if (kind === 'audio') setSelectedAudioId(deviceId);
        else setSelectedVideoId(deviceId);
      } catch (error) {
        console.error(`Error switching ${kind}:`, error);
      }
    },
    []
  );

  const switchOutput = useCallback(async (deviceId: string) => {
    try {
      if (remoteVideoRef.current && 'setSinkId' in remoteVideoRef.current) {
        await (remoteVideoRef.current as any).setSinkId(deviceId);
        setSelectedOutputId(deviceId);
      }
    } catch (error) {
      console.error('Error switching output:', error);
    }
  }, []);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    net.sendCallEnd(fromId);
    cleanup();
    onEnd();
  }, [fromId, cleanup, onEnd]);

  useEffect(() => {
    streamRef.current = localStream;
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0] ?? null; };
    pc.onicecandidate = (e) => { if (e.candidate) net.sendCallIce(fromId, JSON.stringify(e.candidate)); };

    pc.setRemoteDescription({ type: 'offer', sdp: remoteSdp }).then(() =>
      pc.createAnswer()
    ).then(answer => {
      pc.setLocalDescription(answer);
      net.sendCallAnswer(fromId, answer.sdp ?? '');
    });

    const unsubIce = net.on(PacketSC.CALL_ICE, async (packet: Packet) => {
      packet.readInt();
      const c = packet.readString();
      try { if (c) await pc.addIceCandidate(JSON.parse(c)); } catch { /* ignore */ }
    });
    const unsubEnd = net.on(PacketSC.CALL_END, () => { cleanup(); onEnd(); });

    return () => { unsubIce(); unsubEnd(); cleanup(); };
  }, []);

  const toggleMic = () => { localStream.getAudioTracks().forEach(t => { t.enabled = !micOn; }); setMicOn(v => !v); };
  const toggleCam = () => { localStream.getVideoTracks().forEach(t => { t.enabled = !camOn; }); setCamOn(v => !v); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="relative w-full max-w-4xl min-h-[88vh] rounded-[32px] border border-white/10 bg-[#08101e]/95 shadow-[0_0_90px_rgba(0,0,0,0.65)] overflow-hidden font-mono text-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#05101a]/95 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
            <span className="text-[0.72rem] uppercase tracking-[0.3em] text-cyan-300">terminal call</span>
          </div>
          <div className="text-xs text-slate-400">{fromName}</div>
        </div>

        <DeviceSettings
          audioDevices={audioDevices}
          videoDevices={videoDevices}
          audioOutputDevices={audioOutputDevices}
          selectedAudioId={selectedAudioId}
          selectedVideoId={selectedVideoId}
          selectedOutputId={selectedOutputId}
          onAudioChange={(id) => switchDevice('audio', id)}
          onVideoChange={(id) => switchDevice('video', id)}
          onOutputChange={switchOutput}
          isOpen={showSettings}
          onToggle={() => setShowSettings(!showSettings)}
        />

        <div className="relative flex flex-col h-full">
          <div className="flex-1 p-4 sm:p-6">
            {callType === 'video' ? (
              <div className="relative w-full h-full min-h-[320px] rounded-3xl overflow-hidden bg-black/80 border border-white/10">
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/70" />
                <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs text-green-300 uppercase tracking-[0.18em]">
                  Live Video
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[280px] rounded-3xl border border-white/10 bg-[#06111b] p-6 flex flex-col items-center justify-center gap-3 text-green-300">
                <div className="w-24 h-24 rounded-full border border-white/10 overflow-hidden bg-slate-800">
                  <img src={fromAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fromId}`} className="w-full h-full object-cover" />
                </div>
                <div className="text-lg font-semibold text-white">{fromName}</div>
                <div className="text-sm text-slate-400">Voice call</div>
                <div className="w-full rounded-2xl border border-white/10 bg-black/70 p-3 text-left text-sm leading-6 text-green-200">
                  <div>&gt; callType: audio</div>
                  <div>&gt; status: เชื่อมต่อแล้ว</div>
                  <div>&gt; duration: {duration > 0 ? `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}` : '00:00'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-5">
            {callType === 'video' && (
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-24 right-4 w-32 h-24 rounded-xl object-cover border-2 border-white/20 z-20 shadow-2xl" />
            )}
            <CallControls micOn={micOn} camOn={camOn} showCam={callType === 'video'} onToggleMic={toggleMic} onToggleCam={toggleCam} onEnd={endCall}
              duration={duration} label="กำลังคุย" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Incoming Call Modal ──────────────────────────────────────────────────────

export interface IncomingCallData {
  fromId: number;
  fromName: string;
  fromAvatar: string;
  callType: 'audio' | 'video';
  sdp: string;
}

interface IncomingProps {
  call: IncomingCallData;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingProps> = ({ call, onAccept, onReject }) => (
  <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
    className="fixed inset-x-4 bottom-6 z-[9998] mx-auto max-w-md rounded-3xl border border-white/10 bg-[#08101e]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] p-4 font-mono text-white">
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#05101a]/95 px-4 py-3 border border-white/10 mb-4">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
      </div>
      <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">incoming</div>
    </div>
    <div className="flex items-center gap-3 mb-4">
      <img src={call.fromAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${call.fromId}`} className="w-14 h-14 rounded-full object-cover border border-white/10" />
      <div>
        <div className="font-bold text-sm text-white">{call.fromName || `User #${call.fromId}`}</div>
        <div className="text-xs text-slate-400 flex items-center gap-1">
          {call.callType === 'video' ? <Video size={11} /> : <Phone size={11} />}
          {call.callType === 'video' ? 'Video call' : 'Voice call'} เข้ามา
        </div>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <button onClick={onReject} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-red-500/90 hover:bg-red-600/90 py-3 text-sm font-medium transition-colors">
        <PhoneOff size={16} /> ปฏิเสธ
      </button>
      <button onClick={onAccept} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-green-500/90 hover:bg-green-600/90 py-3 text-sm font-medium transition-colors">
        <Phone size={16} /> รับสาย
      </button>
    </div>
  </motion.div>
);
