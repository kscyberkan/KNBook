import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import {
  Play, Pause, Maximize, Minimize, Settings,
  Check, ChevronRight, Gauge, MonitorPlay,
  Volume2, Volume1, VolumeX, X
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  onClose?: () => void;
  title?: string;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onClose, title, autoPlay = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Volume States
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  // Settings States
  const [showSettings, setShowSettings] = useState(false);
  const [settingMode, setSettingMode] = useState<"main" | "quality" | "speed">("main");
  const [quality, setQuality] = useState("720p");
  const [speed, setSpeed] = useState(1);

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
  const qualities = ["1080p", "720p", "480p", "360p"];

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) setShowControls(true);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const updateProgress = () => {
    if (videoRef.current) {
      setProgress(videoRef.current.currentTime);
      requestRef.current = requestAnimationFrame(updateProgress);
    }
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateProgress);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && !showSettings) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (isMuted) handleVolumeChange(prevVolume || 0.5);
    else { setPrevVolume(volume); handleVolumeChange(0); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
  };

  const formatTimeFull = (time: number) => {
    if (isNaN(time)) return "00:00.000";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-gray-100 group shadow-2xl">
      <section
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
        style={{ cursor: showControls ? "default" : "none" }}
        className={`relative w-full h-full bg-black transition-all duration-300
        ${isFullscreen ? "fixed inset-0 z-[9999] rounded-none border-none w-screen h-screen" : "aspect-video"}`}
      >
        <video
          ref={videoRef} 
          src={src}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          autoPlay={autoPlay}
        />

        {/* Header Controls (Title & Close) */}
        <AnimatePresence>
          {showControls && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-20 text-white"
            >
              <h3 className="text-sm font-bold truncate pr-10">{title || "Video Preview"}</h3>
              {onClose && (
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play Overlay */}
        <AnimatePresence>
          {(!isPlaying || showControls) && showControls && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={togglePlay}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 z-10 shadow-2xl cursor-pointer hover:bg-black/40 transition-colors"
            >
              {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" className="ml-1" />}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Settings Menu */}
        <AnimatePresence>
          {showSettings && showControls && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 10, scale: 0.95 }} 
              className="absolute bottom-20 right-6 bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 z-30 min-w-[180px] text-white shadow-2xl overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {settingMode === "main" ? (
                  <motion.div key="main" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="flex flex-col gap-1">
                    <p className="text-[10px] opacity-40 font-bold px-3 py-1 uppercase tracking-widest text-center">Settings</p>
                    <button onClick={() => setSettingMode("speed")} className="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-all cursor-pointer">
                      <div className="flex items-center gap-2 text-xs"><Gauge size={16} /> Speed</div>
                      <span className="opacity-50 text-[10px] flex items-center">{speed === 1 ? "Normal" : `${speed}x`} <ChevronRight size={12} /></span>
                    </button>
                    {/*<button onClick={() => setSettingMode("quality")} className="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-all cursor-pointer">
                      <div className="flex items-center gap-2 text-xs"><MonitorPlay size={16} /> Quality</div>
                      <span className="opacity-50 text-[10px] flex items-center">{quality} <ChevronRight size={12} /></span>
                    </button>}*/}
                  </motion.div>
                ) : (
                  <motion.div key="sub" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} className="flex flex-col">
                    <button onClick={() => setSettingMode("main")} className="p-1.5 text-[10px] font-bold opacity-40 uppercase tracking-widest hover:opacity-100 flex items-center gap-1 mb-1 cursor-pointer">
                      <ChevronRight size={12} className="rotate-180" /> Back
                    </button>
                    <div className="overflow-y-auto max-h-[200px] flex flex-col gap-1 videospeed-scrollbar">
                      {(settingMode === "speed" ? speeds : qualities).map(item => {
                        const isActive = (settingMode === "speed" ? speed : quality) === item;
                        return (
                          <button
                            key={item}
                            onClick={() => {
                              if (settingMode === "speed") {
                                if (videoRef.current) videoRef.current.playbackRate = Number(item);
                                setSpeed(Number(item));
                              } else {
                                setQuality(String(item));
                              }
                              setSettingMode("main");
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] transition-all cursor-pointer ${isActive ? 'bg-blue-600/30 border border-blue-600/50' : 'hover:bg-white/5 border border-transparent opacity-60'}`}
                          >
                            <span>{settingMode === "speed" ? (item === 1 ? "Normal" : `${item}x`) : item}</span>
                            {isActive && <Check size={14} className="text-blue-500" strokeWidth={3} />}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Controls */}
        <AnimatePresence>
          {showControls && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }} 
              className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col gap-2.5 z-20"
            >
              <div className="flex justify-between text-[10px] text-white/80 font-mono tabular-nums px-1">
                <span>{formatTimeFull(progress)}</span>
                <span>{formatTimeFull(videoRef.current?.duration || 0)}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white hover:text-blue-500 transition-colors cursor-pointer active:scale-90 shrink-0">
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>

                <div className="group flex items-center gap-2 overflow-hidden transition-all duration-300 max-w-[32px] hover:max-w-[120px]">
                  <button onClick={toggleMute} className="text-white hover:text-blue-500 cursor-pointer shrink-0">
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={isMuted ? 0 : volume} 
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))} 
                    style={{ background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 0%)` }} 
                    className="w-16 h-1 appearance-none rounded-full cursor-pointer accent-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                  />
                </div>

                <input 
                  type="range" 
                  min="0" 
                  max={videoRef.current?.duration || 0} 
                  step="0.001" 
                  value={progress} 
                  onChange={(e) => { 
                    const val = parseFloat(e.target.value); 
                    if (videoRef.current) videoRef.current.currentTime = val; 
                    setProgress(val); 
                  }} 
                  style={{ 
                    background: `linear-gradient(to right, #3b82f6 ${(progress / (videoRef.current?.duration || 1)) * 100}%, rgba(255,255,255,0.1) 0%)` 
                  }} 
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-white" 
                />

                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => { setShowSettings(!showSettings); setSettingMode("main"); }} className={`transition-all cursor-pointer hover:scale-110 ${showSettings ? "text-blue-500 rotate-45" : "text-white"}`}>
                    <Settings size={18} />
                  </button>
                  <button onClick={toggleFullscreen} className="text-white hover:text-blue-500 transition-colors cursor-pointer hover:scale-110">
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};
