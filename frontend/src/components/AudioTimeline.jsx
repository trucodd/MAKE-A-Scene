import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function AudioTimeline({ tracks, onTracksChange }) {
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedClip, setSelectedClip] = useState(null);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const timelineRef = useRef(null);
  const audioRef = useRef(null);
  const playbackInterval = useRef(null);

  const PIXELS_PER_SECOND = 100 * zoom;
  const TRACK_HEIGHT = 60;

  const totalDuration = tracks.length > 0 
    ? Math.max(...tracks.map(track => (track.startTime || 0) + (track.duration || 0)))
    : 10;

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  }, []);

  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 120;
    const time = x / PIXELS_PER_SECOND;
    setPlayhead(Math.max(0, Math.min(time, totalDuration)));
  }, [PIXELS_PER_SECOND, totalDuration]);

  const handleClipDrag = useCallback((clipId, newStartTime) => {
    onTracksChange(tracks.map(track => 
      track.id === clipId 
        ? { ...track, startTime: Math.max(0, newStartTime) }
        : track
    ));
  }, [tracks, onTracksChange]);

  const findEmptySpaces = (trackType) => {
    let clips;
    if (trackType === 'tts') {
      clips = tracks.filter(t => t.type === 'tts' || t.type === 'sound').sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    } else {
      clips = tracks.filter(t => t.type === trackType).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    }
    
    const spaces = [];
    
    if (clips.length === 0 || (clips[0].startTime || 0) > 0) {
      spaces.push({ start: 0, end: clips.length > 0 ? (clips[0].startTime || 0) : totalDuration });
    }
    
    for (let i = 0; i < clips.length - 1; i++) {
      const currentEnd = (clips[i].startTime || 0) + (clips[i].duration || 0);
      const nextStart = clips[i + 1].startTime || 0;
      if (nextStart > currentEnd + 0.1) {
        spaces.push({ start: currentEnd, end: nextStart });
      }
    }
    
    if (clips.length > 0) {
      const lastEnd = (clips[clips.length - 1].startTime || 0) + (clips[clips.length - 1].duration || 0);
      if (lastEnd < totalDuration) {
        spaces.push({ start: lastEnd, end: totalDuration });
      }
    }
    
    return spaces.filter(space => (space.end - space.start) > 0.5);
  };

  const [insertPosition, setInsertPosition] = useState(0);
  const [insertGapSize, setInsertGapSize] = useState(0);
  const [insertTrackType, setInsertTrackType] = useState('background');

  const addBackgroundSound = (sound) => {
    const audio = new Audio(sound.url);
    audio.addEventListener('loadedmetadata', () => {
      const soundDuration = audio.duration;
      let finalDuration = soundDuration;
      let updatedTracks = [...tracks];
      
      // Only push clips on the same track type, not across different tracks
      if (soundDuration > insertGapSize && insertGapSize > 0) {
        const pushAmount = soundDuration - insertGapSize;
        const targetTrackType = insertTrackType === 'tts' ? ['tts', 'sound'] : [insertTrackType];
        
        updatedTracks = tracks.map(track => {
          // Only push clips that are on the same track and after the insert position
          if (targetTrackType.includes(track.type) && (track.startTime || 0) > insertPosition) {
            return { ...track, startTime: (track.startTime || 0) + pushAmount };
          }
          return track;
        });
      } else if (insertGapSize > 0 && insertGapSize < soundDuration) {
        finalDuration = insertGapSize;
      }
      
      const newTrack = {
        id: Date.now(),
        name: sound.name,
        audioData: sound.url,
        type: insertTrackType === 'tts' ? 'sound' : 'background',
        volume: 0.5,
        startTime: insertPosition,
        duration: finalDuration,
        originalDuration: soundDuration,
        inPoint: 0,
        outPoint: soundDuration,
        trimStart: 0,
        trimEnd: 0
      };
      
      onTracksChange([...updatedTracks, newTrack]);
    });
    
    setShowSoundPicker(false);
    setInsertPosition(0);
    setInsertGapSize(0);
    setInsertTrackType('background');
  };

  const playFromPlayhead = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playbackInterval.current) {
        cancelAnimationFrame(playbackInterval.current);
        playbackInterval.current = null;
      }
      if (audioRef.current?.stop) {
        audioRef.current.stop();
      }
      document.querySelectorAll('.timeline-audio').forEach(a => {
        a.pause();
        a.currentTime = 0;
      });
    } else {
      if (tracks.length === 0) return;
      
      setIsPlaying(true);
      
      const ttsClips = tracks.filter(t => (t.type === 'tts' || t.type === 'sound') && t.audioData).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      const bgClips = tracks.filter(t => t.type === 'background' && t.audioData).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      
      let hasAudio = false;
      const activeAudios = [];
      
      bgClips.forEach(bgClip => {
        const bgStart = bgClip.startTime || 0;
        const bgEnd = bgStart + (bgClip.duration || 0);
        
        if (playhead >= bgStart && playhead < bgEnd) {
          hasAudio = true;
          const bgAudio = new Audio(bgClip.audioData);
          bgAudio.className = 'timeline-audio';
          bgAudio.volume = (bgClip.volume || 1.0) * 0.3;
          const inPoint = bgClip.inPoint || 0;
          const outPoint = bgClip.outPoint || bgClip.originalDuration || bgClip.duration;
          
          bgAudio.currentTime = inPoint + (playhead - bgStart);
          
          const checkTrimEnd = () => {
            if (bgAudio.currentTime >= outPoint) {
              bgAudio.pause();
            }
          };
          bgAudio.addEventListener('timeupdate', checkTrimEnd);
          
          bgAudio.play().catch(console.error);
          activeAudios.push(bgAudio);
        } else if (bgStart > playhead) {
          hasAudio = true;
          const delay = (bgStart - playhead) * 1000;
          setTimeout(() => {
            if (isStillPlaying) {
              const bgAudio = new Audio(bgClip.audioData);
              bgAudio.className = 'timeline-audio';
              bgAudio.volume = (bgClip.volume || 1.0) * 0.3;
              const inPoint = bgClip.inPoint || 0;
              const outPoint = bgClip.outPoint || bgClip.originalDuration || bgClip.duration;
              
              bgAudio.currentTime = inPoint;
              
              const checkTrimEnd = () => {
                if (bgAudio.currentTime >= outPoint) {
                  bgAudio.pause();
                }
              };
              bgAudio.addEventListener('timeupdate', checkTrimEnd);
              
              bgAudio.play().catch(console.error);
              activeAudios.push(bgAudio);
            }
          }, delay);
        }
      });
      
      let isStillPlaying = true;
      ttsClips.forEach(ttsClip => {
        const ttsStart = ttsClip.startTime || 0;
        const ttsEnd = ttsStart + (ttsClip.duration || 0);
        
        if (playhead >= ttsStart && playhead < ttsEnd) {
          hasAudio = true;
          const ttsAudio = new Audio(ttsClip.audioData);
          ttsAudio.className = 'timeline-audio';
          ttsAudio.volume = ttsClip.volume || 1.0;
          
          if (ttsClip.type === 'sound') {
            const inPoint = ttsClip.inPoint || 0;
            const outPoint = ttsClip.outPoint || ttsClip.originalDuration || ttsClip.duration;
            ttsAudio.currentTime = inPoint + (playhead - ttsStart);
            
            const checkTrimEnd = () => {
              if (ttsAudio.currentTime >= outPoint) {
                ttsAudio.pause();
              }
            };
            ttsAudio.addEventListener('timeupdate', checkTrimEnd);
          } else {
            ttsAudio.currentTime = playhead - ttsStart;
          }
          
          ttsAudio.play().catch(console.error);
          activeAudios.push(ttsAudio);
        } else if (ttsStart > playhead) {
          hasAudio = true;
          const delay = (ttsStart - playhead) * 1000;
          setTimeout(() => {
            if (isStillPlaying) {
              const ttsAudio = new Audio(ttsClip.audioData);
              ttsAudio.className = 'timeline-audio';
              ttsAudio.volume = ttsClip.volume || 1.0;
              
              if (ttsClip.type === 'sound') {
                const inPoint = ttsClip.inPoint || 0;
                const outPoint = ttsClip.outPoint || ttsClip.originalDuration || ttsClip.duration;
                ttsAudio.currentTime = inPoint;
                
                const checkTrimEnd = () => {
                  if (ttsAudio.currentTime >= outPoint) {
                    ttsAudio.pause();
                  }
                };
                ttsAudio.addEventListener('timeupdate', checkTrimEnd);
              } else {
                ttsAudio.currentTime = 0;
              }
              
              ttsAudio.play().catch(console.error);
              activeAudios.push(ttsAudio);
            }
          }, delay);
        }
      });
      
      if (!hasAudio) {
        setIsPlaying(false);
        return;
      }
      
      audioRef.current = { 
        stop: () => { 
          isStillPlaying = false;
          activeAudios.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
          });
          document.querySelectorAll('.timeline-audio').forEach(a => {
            a.pause();
            a.currentTime = 0;
          });
        },
        activeAudios
      };
      
      const startTime = Date.now();
      const startPlayhead = playhead;
      let animationId = null;
      
      const updatePlayhead = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newPlayhead = startPlayhead + elapsed;
        
        if (newPlayhead >= totalDuration) {
          setIsPlaying(false);
          setPlayhead(totalDuration);
          if (audioRef.current?.stop) audioRef.current.stop();
          playbackInterval.current = null;
        } else {
          setPlayhead(newPlayhead);
          animationId = requestAnimationFrame(updatePlayhead);
          playbackInterval.current = animationId;
        }
      };
      
      animationId = requestAnimationFrame(updatePlayhead);
      playbackInterval.current = animationId;
    }
  }, [isPlaying, playhead, tracks, totalDuration]);

  useEffect(() => {
    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="bg-gradient-to-br from-black via-dark-purple/50 to-black text-white border border-deep-purple/30 rounded-2xl overflow-hidden my-6 shadow-2xl shadow-deep-purple/20">
      <div className="bg-gradient-to-br from-dark-purple/90 to-dark-blue/90 px-5 py-4 border-b border-deep-purple/30">
        <div className="flex items-center gap-5">
          <button 
            onClick={playFromPlayhead}
            className="bg-gradient-to-br from-deep-purple/30 to-neon-green/30 text-white border border-deep-purple/30 rounded-lg px-4 py-2.5 font-semibold text-sm transition-all duration-300 hover:bg-gradient-to-br hover:from-deep-purple/50 hover:to-neon-green/50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-deep-purple/30"
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <span className="font-mono text-lg font-bold bg-gradient-to-r from-neon-green to-deep-purple bg-clip-text text-transparent">
            {formatTime(playhead)}
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
              className="bg-gradient-to-br from-deep-purple/30 to-neon-green/30 text-white border border-deep-purple/30 rounded-lg px-3 py-2 text-sm transition-all duration-300 hover:bg-gradient-to-br hover:from-deep-purple/50 hover:to-neon-green/50 hover:-translate-y-0.5"
            >
              🔍-
            </button>
            <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(Math.min(4, zoom + 0.25))}
              className="bg-gradient-to-br from-deep-purple/30 to-neon-green/30 text-white border border-deep-purple/30 rounded-lg px-3 py-2 text-sm transition-all duration-300 hover:bg-gradient-to-br hover:from-deep-purple/50 hover:to-neon-green/50 hover:-translate-y-0.5"
            >
              🔍+
            </button>
          </div>
        </div>
      </div>

      <div className="relative bg-gray-800 min-h-[200px] overflow-x-auto overflow-y-visible" ref={timelineRef} onClick={handleTimelineClick}>
        <div className="h-8 bg-gray-700 border-b border-gray-600 relative">
          {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
            <div 
              key={i} 
              className="absolute h-full border-l border-gray-500 pl-1 text-xs text-gray-300 flex items-center" 
              style={{ left: i * PIXELS_PER_SECOND }}
            >
              <span>{formatTime(i)}</span>
            </div>
          ))}
        </div>

        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none" 
          style={{ left: 120 + playhead * PIXELS_PER_SECOND }}
        />

        <div className="py-2.5">
          <div className="flex mb-2.5 border-b border-gray-600">
            <div className="w-30 px-2.5 bg-gray-700 text-gray-300 text-xs font-bold flex items-center justify-between border-r border-gray-600">
              Main Audio (TTS)
            </div>
            <div className="flex-1 relative bg-gray-700 min-w-[800px]" style={{ height: TRACK_HEIGHT }}>
              {tracks.filter(t => t.type === 'tts' || t.type === 'sound').map(clip => (
                <AudioClip
                  key={clip.id}
                  clip={clip}
                  pixelsPerSecond={PIXELS_PER_SECOND}
                  trackHeight={TRACK_HEIGHT}
                  isSelected={selectedClip === clip.id}
                  onSelect={() => setSelectedClip(selectedClip === clip.id ? null : clip.id)}
                  onDrag={(updates) => {
                    if (typeof updates === 'number') {
                      handleClipDrag(clip.id, updates);
                    } else {
                      onTracksChange(tracks.map(t => 
                        t.id === clip.id ? { ...t, ...updates } : t
                      ));
                    }
                  }}
                  playhead={playhead}
                  isTimelinePlaying={isPlaying}
                  formatTime={formatTime}
                />
              ))}
              {findEmptySpaces('tts').map((space, i) => (
                <div
                  key={`tts-space-${i}`}
                  className="absolute bg-white/10 border-2 border-dashed border-white/30 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
                  style={{
                    left: space.start * PIXELS_PER_SECOND,
                    width: (space.end - space.start) * PIXELS_PER_SECOND,
                    height: TRACK_HEIGHT - 4,
                    top: 2
                  }}
                >
                  <button
                    className="bg-gradient-to-br from-neon-green/80 to-deep-purple/80 text-white border border-neon-green/50 rounded-full w-9 h-9 font-bold text-lg flex items-center justify-center transition-all duration-300 hover:bg-gradient-to-br hover:from-neon-green hover:to-deep-purple hover:scale-115 hover:shadow-lg hover:shadow-neon-green/50"
                    onClick={() => {
                      setInsertPosition(space.start);
                      setInsertGapSize(space.end - space.start);
                      setInsertTrackType('tts');
                      setShowSoundPicker(true);
                    }}
                    title="Add TTS sound here"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex mb-2.5 border-b border-gray-600">
            <div className="w-30 px-2.5 bg-blue-800 text-gray-300 text-xs font-bold flex items-center justify-between border-r border-gray-600">
              Background
              <button
                className="bg-gradient-to-br from-neon-green/80 to-deep-purple/80 text-white border border-neon-green/50 rounded-full w-6 h-6 font-bold text-base flex items-center justify-center transition-all duration-300 hover:bg-gradient-to-br hover:from-neon-green hover:to-deep-purple hover:scale-120 hover:shadow-md hover:shadow-neon-green/50"
                onClick={() => {
                  setInsertPosition(0);
                  setInsertGapSize(totalDuration);
                  setInsertTrackType('background');
                  setShowSoundPicker(true);
                }}
                title="Add background sound"
              >
                +
              </button>
            </div>
            <div className="flex-1 relative bg-blue-700 min-w-[800px]" style={{ height: TRACK_HEIGHT }}>
              {tracks.filter(t => t.type === 'background').map(clip => (
                <AudioClip
                  key={clip.id}
                  clip={clip}
                  pixelsPerSecond={PIXELS_PER_SECOND}
                  trackHeight={TRACK_HEIGHT}
                  isSelected={selectedClip === clip.id}
                  onSelect={() => setSelectedClip(selectedClip === clip.id ? null : clip.id)}
                  onDrag={(updates) => {
                    if (typeof updates === 'number') {
                      handleClipDrag(clip.id, updates);
                    } else {
                      onTracksChange(tracks.map(t => 
                        t.id === clip.id ? { ...t, ...updates } : t
                      ));
                    }
                  }}
                  playhead={playhead}
                  isTimelinePlaying={isPlaying}
                  formatTime={formatTime}
                />
              ))}
              {findEmptySpaces('background').map((space, i) => (
                <div
                  key={`bg-space-${i}`}
                  className="absolute bg-white/10 border-2 border-dashed border-white/30 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
                  style={{
                    left: space.start * PIXELS_PER_SECOND,
                    width: (space.end - space.start) * PIXELS_PER_SECOND,
                    height: TRACK_HEIGHT - 4,
                    top: 2
                  }}
                >
                  <button
                    className="bg-gradient-to-br from-neon-green/80 to-deep-purple/80 text-white border border-neon-green/50 rounded-full w-9 h-9 font-bold text-lg flex items-center justify-center transition-all duration-300 hover:bg-gradient-to-br hover:from-neon-green hover:to-deep-purple hover:scale-115 hover:shadow-lg hover:shadow-neon-green/50"
                    onClick={() => {
                      setInsertPosition(space.start);
                      setInsertGapSize(space.end - space.start);
                      setInsertTrackType('background');
                      setShowSoundPicker(true);
                    }}
                    title="Add background sound here"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedClip && (
        <ClipPropertiesPanel 
          clip={tracks.find(t => t.id === selectedClip)}
          onUpdate={(updates) => {
            onTracksChange(tracks.map(t => 
              t.id === selectedClip ? { ...t, ...updates } : t
            ));
          }}
          onDelete={() => {
            onTracksChange(tracks.filter(t => t.id !== selectedClip));
            setSelectedClip(null);
          }}
        />
      )}

      {showSoundPicker && (
        <SoundPicker 
          onSelect={addBackgroundSound}
          onClose={() => setShowSoundPicker(false)}
        />
      )}
    </div>
  );
}

function AudioClip({ clip, pixelsPerSecond, trackHeight, isSelected, onSelect, onDrag, playhead, isTimelinePlaying, formatTime }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, startTime: 0 });
  const [isClipPlaying, setIsClipPlaying] = useState(false);
  const [resizing, setResizing] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const [trimTooltip, setTrimTooltip] = useState({ show: false, x: 0, y: 0, time: 0 });
  const canvasRef = useRef(null);
  const clipAudioRef = useRef(null);
  const animationRef = useRef(null);

  const handleTrimStart = useCallback((e) => {
    e.stopPropagation();
    setResizing('start');
    setDragStart({ x: e.clientX, startTime: clip.startTime, duration: clip.duration, inPoint: clip.inPoint || 0 });
  }, [clip.startTime, clip.duration, clip.inPoint]);

  const handleTrimEnd = useCallback((e) => {
    e.stopPropagation();
    setResizing('end');
    setDragStart({ x: e.clientX, startTime: clip.startTime, duration: clip.duration, outPoint: clip.outPoint || clip.duration });
  }, [clip.startTime, clip.duration, clip.outPoint]);

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (resizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaTime = deltaX / pixelsPerSecond;
        
        if (resizing === 'start') {
          const maxInPoint = (clip.originalDuration || clip.duration) - 0.1;
          const newInPoint = Math.max(0, Math.min(maxInPoint, dragStart.inPoint + deltaTime));
          const newDuration = (clip.outPoint || clip.originalDuration || clip.duration) - newInPoint;
          
          setTrimTooltip({
            show: true,
            x: e.clientX + 10,
            y: e.clientY - 30,
            time: newInPoint
          });
          
          onDrag({ 
            inPoint: newInPoint, 
            duration: newDuration
          });
        } else if (resizing === 'end') {
          const maxOutPoint = clip.originalDuration || clip.duration;
          const minOutPoint = (clip.inPoint || 0) + 0.1;
          const newOutPoint = Math.max(minOutPoint, Math.min(maxOutPoint, dragStart.outPoint + deltaTime));
          const newDuration = newOutPoint - (clip.inPoint || 0);
          
          setTrimTooltip({
            show: true,
            x: e.clientX + 10,
            y: e.clientY - 30,
            time: newOutPoint
          });
          
          onDrag({
            outPoint: newOutPoint,
            duration: newDuration
          });
        }
      }
    };

    const handleResizeUp = () => {
      setResizing(null);
      setTrimTooltip({ show: false, x: 0, y: 0, time: 0 });
    };

    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeUp);
      };
    }
  }, [resizing, dragStart, pixelsPerSecond, onDrag, clip.inPoint, clip.outPoint, clip.duration]);

  const isTrimmableClip = clip.type === 'sound' || clip.type === 'background';
  const originalDuration = clip.originalDuration || clip.duration;
  const inPoint = clip.inPoint || 0;
  const outPoint = clip.outPoint || originalDuration;
  
  const clipWidth = isTrimmableClip ? (outPoint - inPoint) * pixelsPerSecond : clip.duration * pixelsPerSecond;
  const clipLeft = (clip.startTime || 0) * pixelsPerSecond;

  const generateWaveform = useCallback(() => {
    const isTrimmableClip = clip.type === 'sound' || clip.type === 'background';
    const originalDuration = clip.originalDuration || clip.duration;
    const inPoint = clip.inPoint || 0;
    const outPoint = clip.outPoint || originalDuration;
    
    if (isTrimmableClip) {
      const totalBars = Math.floor((originalDuration * pixelsPerSecond) / 3);
      const fullWaveform = [];
      for (let i = 0; i < totalBars; i++) {
        fullWaveform.push(Math.random() * 0.8 + 0.1);
      }
      
      const startIndex = Math.floor((inPoint / originalDuration) * totalBars);
      const endIndex = Math.floor((outPoint / originalDuration) * totalBars);
      const visibleWaveform = fullWaveform.slice(startIndex, endIndex);
      setWaveformData(visibleWaveform);
    } else {
      const bars = Math.floor(clipWidth / 3);
      const data = [];
      for (let i = 0; i < bars; i++) {
        data.push(Math.random() * 0.8 + 0.1);
      }
      setWaveformData(data);
    }
  }, [clipWidth, clip.type, clip.originalDuration, clip.duration, clip.inPoint, clip.outPoint, pixelsPerSecond]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData.length) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const barWidth = 3;
    const clipStart = clip.startTime || 0;
    const clipEnd = clipStart + (clip.duration || 0);
    const currentPlayTime = playhead;
    
    waveformData.forEach((amplitude, i) => {
      const x = i * barWidth;
      const barHeight = amplitude * height * 0.9;
      const y = (height - barHeight) / 2;
      
      const barProgress = i / waveformData.length;
      const barStartTime = clipStart + barProgress * (clip.duration || 0);
      const isActive = isTimelinePlaying && currentPlayTime >= clipStart && currentPlayTime <= clipEnd && currentPlayTime >= barStartTime;
      
      if (isActive) {
        const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(0, 255, 100, ${pulse})`;
        const animatedHeight = barHeight * (1 + pulse * 0.5);
        const animatedY = (height - animatedHeight) / 2;
        ctx.fillRect(x, animatedY, barWidth - 0.5, animatedHeight);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(x, y, barWidth - 0.5, barHeight);
      }
    });
  }, [waveformData, playhead, isTimelinePlaying, clip.startTime, clip.duration, clipWidth]);

  useEffect(() => {
    generateWaveform();
  }, [generateWaveform]);

  useEffect(() => {
    const animate = () => {
      drawWaveform();
      if (isTimelinePlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (isTimelinePlaying) {
      animate();
    } else {
      drawWaveform();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawWaveform, isTimelinePlaying]);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, startTime: clip.startTime || 0 });
  }, [clip.startTime]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaTime = deltaX / pixelsPerSecond;
        onDrag(dragStart.startTime + deltaTime);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, pixelsPerSecond, onDrag]);

  return (
    <>
      {isSelected && isTrimmableClip && (
        <div
          className="absolute rounded-lg select-none overflow-hidden z-5 bg-gray-500/30 border border-gray-400/50"
          style={{
            left: (clip.startTime || 0) * pixelsPerSecond,
            width: originalDuration * pixelsPerSecond,
            height: trackHeight - 4,
            top: 2
          }}
        >
          {inPoint > 0 && (
            <div 
              className="absolute top-0 bottom-0 bg-gray-700/60 border-r border-gray-400"
              style={{ left: 0, width: (inPoint / originalDuration) * (originalDuration * pixelsPerSecond) }}
            />
          )}
          {outPoint < originalDuration && (
            <div 
              className="absolute top-0 bottom-0 bg-gray-700/60 border-l border-gray-400"
              style={{ right: 0, width: ((originalDuration - outPoint) / originalDuration) * (originalDuration * pixelsPerSecond) }}
            />
          )}
        </div>
      )}
      
      <div
        className={`absolute rounded-lg cursor-move select-none overflow-hidden z-10 backdrop-blur-xs transition-all duration-300 hover:brightness-120 hover:-translate-y-0.5 ${
          clip.type === 'tts' 
            ? 'bg-gradient-to-br from-neon-green/80 to-green-600/80 border-2 border-neon-green/60' 
            : 'bg-gradient-to-br from-orange-500/80 to-orange-600/80 border-2 border-orange-500/60'
        } ${
          isSelected 
            ? 'border-neon-green shadow-lg shadow-neon-green/60 scale-102' 
            : 'hover:shadow-md hover:shadow-deep-purple/40'
        }`}
        style={{
          left: clipLeft,
          width: clipWidth,
          height: trackHeight - 4,
          top: 2
        }}
        onMouseDown={handleMouseDown}
      >
        {(clip.type === 'background' || clip.type === 'sound') && (
          <>
            <div 
              className="absolute top-0 bottom-0 w-2 bg-white/90 cursor-ew-resize z-10 opacity-70 transition-all duration-200 border border-blue-500/80 rounded-l hover:bg-blue-500/90 hover:opacity-100 hover:w-2.5 left-0"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleTrimStart(e);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const originalDuration = clip.originalDuration || clip.duration;
                onDrag({ 
                  inPoint: 0,
                  duration: (clip.outPoint || originalDuration)
                });
              }}
              title="Drag to trim start | Double-click to reset"
            />
            <div 
              className="absolute top-0 bottom-0 w-2 bg-white/90 cursor-ew-resize z-10 opacity-70 transition-all duration-200 border border-blue-500/80 rounded-r hover:bg-blue-500/90 hover:opacity-100 hover:w-2.5 right-0"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleTrimEnd(e);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const originalDuration = clip.originalDuration || clip.duration;
                onDrag({ 
                  outPoint: originalDuration,
                  duration: originalDuration - (clip.inPoint || 0)
                });
              }}
              title="Drag to trim end | Double-click to reset"
            />
          </>
        )}
        
        <div className="p-1 h-full flex flex-col justify-between">
          <div className="flex justify-between items-center mb-0.5">
            <button 
              className="bg-gradient-to-br from-deep-purple/80 to-neon-green/80 border-none rounded text-white cursor-pointer text-xs font-semibold px-2 py-0.5 mr-2 transition-all duration-300 hover:bg-gradient-to-br hover:from-deep-purple hover:to-neon-green hover:scale-105"
              onClick={(e) => {
                e.stopPropagation();
                if (isClipPlaying) {
                  if (clipAudioRef.current) {
                    clipAudioRef.current.pause();
                    clipAudioRef.current = null;
                  }
                  setIsClipPlaying(false);
                } else {
                  if (clip.audioData) {
                    document.querySelectorAll('.clip-audio').forEach(a => {
                      a.pause();
                      a.remove();
                    });
                    
                    const audio = new Audio(clip.audioData);
                    audio.className = 'clip-audio';
                    audio.volume = clip.volume || 1.0;
                    
                    if (isTrimmableClip) {
                      const inPoint = clip.inPoint || 0;
                      const outPoint = clip.outPoint || clip.originalDuration || clip.duration;
                      
                      audio.currentTime = inPoint;
                      
                      const checkTime = () => {
                        if (audio.currentTime >= outPoint) {
                          audio.pause();
                          setIsClipPlaying(false);
                        }
                      };
                      audio.addEventListener('timeupdate', checkTime);
                    }
                    
                    audio.onended = () => setIsClipPlaying(false);
                    
                    clipAudioRef.current = audio;
                    audio.play().catch(console.error);
                    setIsClipPlaying(true);
                  }
                }
              }}
              title={isClipPlaying ? "Stop clip" : "Play clip"}
            >
              {isClipPlaying ? '⏸️' : '▶️'}
            </button>
            <div className="flex-1 text-xs font-semibold text-white text-shadow-sm overflow-hidden whitespace-nowrap text-ellipsis">
              {clip.name}
            </div>
            <button 
              className="bg-white/20 border-none text-white text-xs w-4 h-4 rounded-full cursor-pointer flex items-center justify-center opacity-70 transition-all duration-200 hover:opacity-100 hover:bg-white/30"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              title="Clip Settings"
            >
              ⚙️
            </button>
          </div>
          <div className="flex items-end gap-0.5 h-5 overflow-hidden">
            <canvas 
              ref={canvasRef}
              width={clipWidth}
              height={30}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </div>
      
      {trimTooltip.show && (
        <div 
          className="trim-tooltip"
          style={{
            position: 'fixed',
            left: trimTooltip.x,
            top: trimTooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          {formatTime(trimTooltip.time)}
        </div>
      )}
    </>
  );
}

function ClipPropertiesPanel({ clip, onUpdate, onDelete }) {
  const resetTrim = () => {
    const originalDuration = clip.originalDuration || clip.duration;
    onUpdate({ 
      inPoint: 0, 
      outPoint: originalDuration,
      duration: originalDuration
    });
  };

  const hasTrimming = (clip.inPoint > 0) || (clip.outPoint < (clip.originalDuration || clip.duration));

  return (
    <div className="fixed right-5 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white p-4 rounded-lg border border-gray-600 min-w-[200px] z-50">
      <h4 className="m-0 mb-4 text-neon-green">{clip.name}</h4>
      
      {(clip.type === 'background' || clip.type === 'sound') && (
        <>
          <div className="property-group">
            <label>Start Time (seconds)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={clip.startTime || 0}
              onChange={(e) => onUpdate({ startTime: parseFloat(e.target.value) })}
            />
          </div>
          
          <div className="property-group">
            <label>Duration (seconds)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={clip.duration || 0}
              onChange={(e) => onUpdate({ duration: parseFloat(e.target.value) })}
            />
          </div>

          {hasTrimming && (
            <div className="property-group">
              <button onClick={resetTrim} className="reset-trim-btn">↺ Reset Trim</button>
            </div>
          )}
        </>
      )}
      
      <div className="property-group">
        <label>Volume</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={clip.volume || 1}
          onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
        />
        <span>{Math.round((clip.volume || 1) * 100)}%</span>
      </div>
      
      <div className="property-group">
        <label>Trim Start (seconds)</label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={clip.trimStart || 0}
          onChange={(e) => onUpdate({ trimStart: parseFloat(e.target.value) })}
        />
      </div>
      
      <div className="property-group">
        <label>Trim End (seconds)</label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={clip.trimEnd || 0}
          onChange={(e) => onUpdate({ trimEnd: parseFloat(e.target.value) })}
        />
      </div>
      
      <button 
        onClick={onDelete} 
        className="bg-red-600 text-white border-none rounded px-3 py-2 cursor-pointer text-xs w-full mt-2.5 hover:bg-red-700 transition-colors duration-200"
      >
        🗑️ Delete Clip
      </button>
    </div>
  );
}

function SoundPicker({ onSelect, onClose }) {
  const [sounds, setSounds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [playingSound, setPlayingSound] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);

  useEffect(() => {
    fetchSounds();
  }, []);

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingSound(null);
      }
    };
  }, [currentAudio]);

  const fetchSounds = async (search = '') => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/background-sounds?search=${encodeURIComponent(search)}`);
      setSounds(response.data);
    } catch (error) {
      console.error('Error fetching sounds:', error);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    if (query.length > 2) {
      fetchSounds(query);
    } else if (query.length === 0) {
      fetchSounds();
    }
  };

  const handlePlayStop = (sound) => {
    if (playingSound === sound.id) {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingSound(null);
      }
    } else {
      if (currentAudio) {
        currentAudio.pause();
      }
      
      const audio = new Audio(sound.url);
      audio.onended = () => {
        setPlayingSound(null);
        setCurrentAudio(null);
      };
      audio.play().catch(console.error);
      setCurrentAudio(audio);
      setPlayingSound(sound.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-11/12 max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-300">
          <h4 className="m-0 text-gray-800">Select Background Sound</h4>
          <button 
            onClick={onClose}
            className="bg-none border-none text-2xl cursor-pointer text-gray-600 hover:text-gray-800"
          >
            ×
          </button>
        </div>
        
        <input
          type="text"
          placeholder="Search sounds..."
          value={searchTerm}
          onChange={handleSearch}
          className="w-full p-2.5 border border-gray-300 rounded text-base mb-2.5"
        />
        
        {loading && <div className="loading">Searching...</div>}
        
        <div className="p-5">
          {sounds.map(sound => (
            <div key={sound.id} className="flex justify-between items-center p-2.5 border-b border-gray-200 last:border-b-0">
              <span className="text-gray-800">{sound.name}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePlayStop(sound)}
                  className={`${playingSound === sound.id ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white border-none rounded px-2 py-1 cursor-pointer text-xs transition-colors duration-200`}
                >
                  {playingSound === sound.id ? '⏹️' : '▶️'}
                </button>
                <button 
                  onClick={() => onSelect(sound)}
                  className="bg-blue-600 text-white border-none rounded px-2 py-1 cursor-pointer text-xs hover:bg-blue-700 transition-colors duration-200"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AudioTimeline;