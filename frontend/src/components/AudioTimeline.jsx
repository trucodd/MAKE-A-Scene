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

  const actualDuration = tracks.length > 0 
    ? Math.max(...tracks.map(track => (track.startTime || 0) + (track.duration || 0)))
    : 0;
  
  const totalDuration = Math.max(actualDuration + 5, 10);

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
    
    // Always add space from beginning if no clips or first clip doesn't start at 0
    if (clips.length === 0) {
      spaces.push({ start: 0, end: totalDuration });
    } else {
      // Space before first clip
      if ((clips[0].startTime || 0) > 0) {
        spaces.push({ start: 0, end: clips[0].startTime || 0 });
      }
      
      // Spaces between clips
      for (let i = 0; i < clips.length - 1; i++) {
        const currentEnd = (clips[i].startTime || 0) + (clips[i].duration || 0);
        const nextStart = clips[i + 1].startTime || 0;
        if (nextStart > currentEnd + 0.1) {
          spaces.push({ start: currentEnd, end: nextStart });
        }
      }
      
      // Space after last clip
      const lastEnd = (clips[clips.length - 1].startTime || 0) + (clips[clips.length - 1].duration || 0);
      if (lastEnd < totalDuration) {
        spaces.push({ start: lastEnd, end: totalDuration });
      }
    }
    
    return spaces.filter(space => (space.end - space.start) > 0.2);
  };

  const [insertPosition, setInsertPosition] = useState(0);
  const [insertGapSize, setInsertGapSize] = useState(0);
  const [insertTrackType, setInsertTrackType] = useState('background');
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleDragEnd = useCallback(() => {
    setTimeout(() => setIsDragging(false), 200);
  }, []);

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
        
        if (newPlayhead >= actualDuration) {
          setIsPlaying(false);
          setPlayhead(actualDuration);
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
    <div className="bg-white rounded-2xl overflow-hidden my-8 card-shadow border border-gray-200">
      <div className="bg-white px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={playFromPlayhead}
              className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl px-6 py-3 font-medium transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <div className="font-mono text-lg font-medium text-gray-900">
              {formatTime(playhead)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Zoom</span>
            <button 
              onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13H5v-2h14v2z"/>
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(Math.min(4, zoom + 0.25))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="relative bg-white min-h-[300px] overflow-x-auto overflow-y-visible" ref={timelineRef} onClick={handleTimelineClick}>
        <div className="h-10 bg-gray-50 border-b border-gray-200 relative">
          {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
            <div 
              key={i} 
              className="absolute h-full border-l border-gray-300 pl-2 text-xs text-gray-600 flex items-center font-mono" 
              style={{ left: i * PIXELS_PER_SECOND }}
            >
              {formatTime(i)}
            </div>
          ))}
        </div>

        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none" 
          style={{ left: 120 + playhead * PIXELS_PER_SECOND }}
        />

        <div className="py-4">
          <div className="flex border-b border-gray-100">
            <div className="w-32 px-4 py-3 bg-gray-50 text-gray-700 text-sm font-medium flex items-center border-r border-gray-200">
              <span>TTS</span>
            </div>
            <div className="flex-1 relative bg-white min-w-[800px]" style={{ height: 80 }}>
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
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  playhead={playhead}
                  isTimelinePlaying={isPlaying}
                  formatTime={formatTime}
                />
              ))}
              {!isDragging && findEmptySpaces('tts').map((space, i) => (
                <div
                  key={`tts-space-${i}`}
                  className="absolute bg-white/5 border-2 border-dashed border-white/20 rounded flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white/10 transition-all duration-200"
                  style={{
                    left: space.start * PIXELS_PER_SECOND,
                    width: (space.end - space.start) * PIXELS_PER_SECOND,
                    height: TRACK_HEIGHT - 4,
                    top: 2
                  }}
                >
                  <button
                    className="bg-white border border-gray-300 text-gray-600 rounded w-6 h-6 font-medium text-sm flex items-center justify-center transition-colors duration-200 hover:bg-gray-50 hover:border-gray-400"
                    onClick={() => {
                      setInsertPosition(space.start);
                      setInsertGapSize(space.end - space.start);
                      setInsertTrackType('tts');
                      setShowSoundPicker(true);
                    }}
                    title="Add sound to TTS track"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex border-b border-gray-100">
            <div className="w-32 px-4 py-3 bg-gray-50 text-gray-700 text-sm font-medium flex items-center border-r border-gray-200">
              <span>Background</span>
            </div>
            <div className="flex-1 relative bg-white min-w-[800px]" style={{ height: 80 }}>
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
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  playhead={playhead}
                  isTimelinePlaying={isPlaying}
                  formatTime={formatTime}
                />
              ))}
              {!isDragging && findEmptySpaces('background').map((space, i) => (
                <div
                  key={`bg-space-${i}`}
                  className="absolute bg-white/5 border-2 border-dashed border-white/20 rounded flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white/10 transition-all duration-200"
                  style={{
                    left: space.start * PIXELS_PER_SECOND,
                    width: (space.end - space.start) * PIXELS_PER_SECOND,
                    height: TRACK_HEIGHT - 4,
                    top: 2
                  }}
                >
                  <button
                    className="bg-white border border-gray-300 text-gray-600 rounded w-6 h-6 font-medium text-sm flex items-center justify-center transition-colors duration-200 hover:bg-gray-50 hover:border-gray-400"
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
          onClose={() => setSelectedClip(null)}
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

function AudioClip({ clip, pixelsPerSecond, trackHeight, isSelected, onSelect, onDrag, onDragStart, onDragEnd, playhead, isTimelinePlaying, formatTime }) {
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
        const pulse = Math.sin(Date.now() * 0.02) * 0.4 + 0.6;
        ctx.fillStyle = `rgba(34, 197, 94, ${pulse})`;
        const animatedHeight = barHeight * (1.2 + pulse * 0.3);
        const animatedY = (height - animatedHeight) / 2;
        ctx.fillRect(x, animatedY, barWidth - 0.5, animatedHeight);
      } else {
        ctx.fillStyle = 'rgba(107, 114, 128, 0.7)';
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
    if (onDragStart) onDragStart();
  }, [clip.startTime, onDragStart]);

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
      if (onDragEnd) onDragEnd();
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
        className={`absolute rounded cursor-move select-none overflow-hidden z-10 border ${
          clip.type === 'tts' 
            ? 'bg-green-100 border-green-300' 
            : clip.type === 'sound'
            ? 'bg-purple-100 border-purple-300'
            : 'bg-blue-100 border-blue-300'
        } ${
          isSelected 
            ? 'border-2 border-gray-800' 
            : 'hover:border-gray-400'
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
          <div className="flex justify-between items-center mb-1">
            <button 
              className="bg-white border border-gray-300 text-gray-700 rounded text-xs font-medium px-2 py-1 transition-colors duration-200 hover:bg-gray-50"
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
            <div className="flex-1 text-xs font-medium text-gray-700 overflow-hidden whitespace-nowrap text-ellipsis px-1">
              {clip.name}
            </div>
            <button 
              className="bg-white border border-gray-300 text-gray-600 w-7 h-7 rounded cursor-pointer flex items-center justify-center transition-colors duration-200 hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              title="Settings"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
              </svg>
            </button>
          </div>
          <div className="flex items-end gap-0.5 h-8 overflow-hidden bg-white rounded border border-gray-200">
            <canvas 
              ref={canvasRef}
              width={clipWidth}
              height={32}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </div>
      
      {trimTooltip.show && (
        <div 
          className="fixed bg-gray-900 text-white px-2 py-1 rounded-lg text-xs font-medium pointer-events-none z-50 card-shadow"
          style={{
            left: trimTooltip.x,
            top: trimTooltip.y
          }}
        >
          {formatTime(trimTooltip.time)}
        </div>
      )}
    </>
  );
}

function ClipPropertiesPanel({ clip, onUpdate, onDelete, onClose }) {
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
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-4 card-shadow">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <h4 className="text-lg font-semibold text-gray-900 m-0">{clip.name}</h4>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            clip.type === 'tts' ? 'bg-green-400' : 
            clip.type === 'sound' ? 'bg-purple-400' : 'bg-blue-400'
          }`}></div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-50"
            title="Close"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {(clip.type === 'background' || clip.type === 'sound') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time (s)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={clip.startTime || 0}
              onChange={(e) => onUpdate({ startTime: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        )}
        
        {(clip.type === 'background' || clip.type === 'sound') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Duration (s)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={clip.duration || 0}
              onChange={(e) => onUpdate({ duration: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Volume</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={clip.volume || 1}
              onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs font-medium text-gray-600 min-w-[35px]">{Math.round((clip.volume || 1) * 100)}%</span>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Trim Start (s)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={clip.trimStart || 0}
            onChange={(e) => onUpdate({ trimStart: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Trim End (s)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={clip.trimEnd || 0}
            onChange={(e) => onUpdate({ trimEnd: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        {hasTrimming && (
          <button 
            onClick={resetTrim} 
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
          >
            ↺ Reset Trim
          </button>
        )}
        <button 
          onClick={onDelete} 
          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-1 ml-auto hover:-translate-y-0.5"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
          </svg>
          Delete
        </button>
      </div>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col card-shadow-hover">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h4 className="text-lg font-semibold text-gray-900 m-0">Select Background Sound</h4>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-50"
            title="Close"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <div className="p-6 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search sounds..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
          />
        </div>
        
        {loading && (
          <div className="p-6 text-center text-gray-600">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              Searching...
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {sounds.map(sound => (
              <div key={sound.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                <span className="text-gray-900 font-medium">{sound.name}</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePlayStop(sound)}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-1 ${
                      playingSound === sound.id 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                    title={playingSound === sound.id ? 'Stop' : 'Play'}
                  >
                    {playingSound === sound.id ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                  <button 
                    onClick={() => onSelect(sound)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:-translate-y-0.5"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AudioTimeline;