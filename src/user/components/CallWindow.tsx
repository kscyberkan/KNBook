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
      const devices = await navigator.mediaDevices.enumerateDevices();
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
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  const switchDevice = useCallback(
    async (kind: 'audio' | 'video', deviceId: string) => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : undefined,
          video: kind === 'video' ? { deviceId: { exact: deviceId } } : undefined,
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
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
      className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center">
      {callType === 'video' && <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />}
      
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

      <div className="flex flex-col items-center gap-4 z-10">
        <img src={friend.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} className="w-28 h-28 rounded-full object-cover ring-4 ring-white/20 shadow-2xl" />
        <div className="text-white text-xl font-bold">{friend.name}</div>
      </div>
      {callType === 'video' && <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-24 right-4 w-32 h-24 rounded-xl object-cover border-2 border-white/20 z-20" />}
      <CallControls micOn={micOn} camOn={camOn} showCam={callType === 'video'} onToggleMic={toggleMic} onToggleCam={toggleCam} onEnd={endCall}
        duration={duration} label={state === 'calling' ? 'กำลังโทร...' : 'กำลังคุย'} />
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
      const devices = await navigator.mediaDevices.enumerateDevices();
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
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  const switchDevice = useCallback(
    async (kind: 'audio' | 'video', deviceId: string) => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: kind === 'audio' ? { deviceId: { exact: deviceId } } : undefined,
          video: kind === 'video' ? { deviceId: { exact: deviceId } } : undefined,
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
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
      className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center">
      {callType === 'video' && <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />}
      
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

      <div className="flex flex-col items-center gap-4 z-10">
        <img src={fromAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fromId}`} className="w-28 h-28 rounded-full object-cover ring-4 ring-white/20" />
        <div className="text-white text-xl font-bold">{fromName}</div>
      </div>
      {callType === 'video' && <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-24 right-4 w-32 h-24 rounded-xl object-cover border-2 border-white/20 z-20" />}
      <CallControls micOn={micOn} camOn={camOn} showCam={callType === 'video'} onToggleMic={toggleMic} onToggleCam={toggleCam} onEnd={endCall}
        duration={duration} label="กำลังคุย" />
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
    className="fixed bottom-24 right-6 z-[9998] bg-gray-900 text-white rounded-2xl shadow-2xl p-4 w-72">
    <div className="flex items-center gap-3 mb-4">
      <img src={call.fromAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${call.fromId}`} className="w-12 h-12 rounded-full object-cover" />
      <div>
        <div className="font-bold text-sm">{call.fromName || `User #${call.fromId}`}</div>
        <div className="text-xs text-gray-400 flex items-center gap-1">
          {call.callType === 'video' ? <Video size={11} /> : <Phone size={11} />}
          {call.callType === 'video' ? 'Video call' : 'Voice call'} เข้ามา
        </div>
      </div>
    </div>
    <div className="flex gap-3">
      <button onClick={onReject} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-medium transition-colors">
        <PhoneOff size={16} /> ปฏิเสธ
      </button>
      <button onClick={onAccept} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl text-sm font-medium transition-colors">
        <Phone size={16} /> รับสาย
      </button>
    </div>
  </motion.div>
);
