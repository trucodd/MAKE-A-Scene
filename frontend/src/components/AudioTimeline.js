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

  const totalDuration = Math.max(
    ...tracks.map(track => (track.startTime || 0) + (track.duration || 0)),
    10
  );

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  }, []);

  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 120; // Account for track label width
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
    
    if (clips.length === 0 || clips[0].startTime > 0) {
      spaces.push({ start: 0, end: clips.length > 0 ? clips[0].startTime : totalDuration });
    }
    
    for (let i = 0; i < clips.length - 1; i++) {
      const currentEnd = clips[i].startTime + clips[i].duration;
      const nextStart = clips[i + 1].startTime;
      if (nextStart > currentEnd) {
        spaces.push({ start: currentEnd, end: nextStart });
      }
    }
    
    if (clips.length > 0) {
      const lastEnd = clips[clips.length - 1].startTime + clips[clips.length - 1].duration;
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
    const soundDuration = 10;
    let finalDuration = soundDuration;
    let updatedTracks = [...tracks];
    
    if (soundDuration > insertGapSize && insertGapSize > 0) {
      const pushAmount = soundDuration - insertGapSize;
      updatedTracks = tracks.map(track => {
        if (track.startTime > insertPosition) {
          return { ...track, startTime: track.startTime + pushAmount };
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
    setShowSoundPicker(false);
    setInsertPosition(0);
    setInsertGapSize(0);
    setInsertTrackType('background');
  };

  const playFromPlayhead = useCallback(() => {
    if (isPlaying) {
      // Stop mixed playback
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
      // Only play if there are tracks
      if (tracks.length === 0) return;
      
      setIsPlaying(true);
      
      const ttsClips = tracks.filter(t => (t.type === 'tts' || t.type === 'sound') && t.audioData).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      const bgClips = tracks.filter(t => t.type === 'background' && t.audioData).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
      
      let hasAudio = false;
      
      const activeAudios = [];
      
      // Start background sounds that should be playing
      bgClips.forEach(bgClip => {
        const bgStart = bgClip.startTime || 0;
        const bgEnd = bgStart + (bgClip.duration || 0);
        
        if (playhead >= bgStart && playhead < bgEnd) {
          // Background clip is currently playing
          hasAudio = true;
          const bgAudio = new Audio(bgClip.audioData);
          bgAudio.className = 'timeline-audio';
          bgAudio.volume = (bgClip.volume || 1.0) * 0.3;
          const inPoint = bgClip.inPoint || 0;
          bgAudio.currentTime = inPoint + (playhead - bgStart);
          bgAudio.play().catch(console.error);
          activeAudios.push(bgAudio);
        } else if (bgStart > playhead) {
          // Background clip will play in the future - schedule it
          hasAudio = true;
          const delay = (bgStart - playhead) * 1000;
          setTimeout(() => {
            if (isStillPlaying) {
              const bgAudio = new Audio(bgClip.audioData);
              bgAudio.className = 'timeline-audio';
              bgAudio.volume = (bgClip.volume || 1.0) * 0.3;
              const inPoint = bgClip.inPoint || 0;
              bgAudio.currentTime = inPoint;
              bgAudio.play().catch(console.error);
              activeAudios.push(bgAudio);
            }
          }, delay);
        }
      });
      
      // Play TTS clips that should be playing now or schedule future ones
      let isStillPlaying = true;
      ttsClips.forEach(ttsClip => {
        const ttsStart = ttsClip.startTime || 0;
        const ttsEnd = ttsStart + (ttsClip.duration || 0);
        
        if (playhead >= ttsStart && playhead < ttsEnd) {
          // TTS is currently playing - start it from current position
          hasAudio = true;
          const ttsAudio = new Audio(ttsClip.audioData);
          ttsAudio.className = 'timeline-audio';
          ttsAudio.volume = ttsClip.volume || 1.0;
          const inPoint = ttsClip.inPoint || 0;
          ttsAudio.currentTime = inPoint + (playhead - ttsStart);
          ttsAudio.play().catch(console.error);
          activeAudios.push(ttsAudio);
        } else if (ttsStart > playhead) {
          // TTS will play in the future - schedule it
          hasAudio = true;
          const delay = (ttsStart - playhead) * 1000;
          setTimeout(() => {
            if (isStillPlaying) {
              const ttsAudio = new Audio(ttsClip.audioData);
              ttsAudio.className = 'timeline-audio';
              ttsAudio.volume = ttsClip.volume || 1.0;
              const inPoint = ttsClip.inPoint || 0;
              ttsAudio.currentTime = inPoint;
              ttsAudio.play().catch(console.error);
              activeAudios.push(ttsAudio);
            }
          }, delay);
        }
      });
      
      // If no audio to play, don't start playback
      if (!hasAudio) {
        setIsPlaying(false);
        return;
      }
      
      // Store reference to stop all audio
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
      
      // Update playhead in sync with audio
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
    <div className="audio-timeline">
      <div className="timeline-header">
        <div className="timeline-controls">
          <button onClick={playFromPlayhead}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <span className="time-display">{formatTime(playhead)}</span>
          <div className="zoom-controls">
            <button onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}>🔍-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(4, zoom + 0.25))}>🔍+</button>
          </div>
        </div>
      </div>

      <div className="timeline-container" ref={timelineRef} onClick={handleTimelineClick}>
        <div className="time-ruler">
          {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
            <div 
              key={i} 
              className="time-marker" 
              style={{ left: i * PIXELS_PER_SECOND }}
            >
              <span>{formatTime(i)}</span>
            </div>
          ))}
        </div>

        <div 
          className="playhead" 
          style={{ left: 120 + playhead * PIXELS_PER_SECOND }}
        />

        <div className="track-lanes">
          <div className="track-lane main-track-lane">
            <div className="track-label">Main Audio (TTS)</div>
            <div className="track-content" style={{ height: TRACK_HEIGHT }}>
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
                  className="empty-space-indicator"
                  style={{
                    left: space.start * PIXELS_PER_SECOND,
                    width: (space.end - space.start) * PIXELS_PER_SECOND,
                    height: TRACK_HEIGHT - 4,
                    top: 2
                  }}
                >
                  <button
                    className="add-clip-btn"
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

          <div className="track-lane bg-track-lane">
            <div className="track-label">Background</div>
            <div className="track-content" style={{ height: TRACK_HEIGHT }}>
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
                  className="empty-space-indicator"
                  style={{
                    left: space.start * PIXELS_PER_SECOND,
                    width: (space.end - space.start) * PIXELS_PER_SECOND,
                    height: TRACK_HEIGHT - 4,
                    top: 2
                  }}
                >
                  <button
                    className="add-clip-btn"
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
          // Dragging left edge inward/outward - adjust in point
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
          // Dragging right edge inward/outward - adjust out point
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

  // Use non-destructive editing only for sound/background clips
  const isTrimmableClip = clip.type === 'sound' || clip.type === 'background';
  const originalDuration = clip.originalDuration || clip.duration;
  const inPoint = clip.inPoint || 0;
  const outPoint = clip.outPoint || originalDuration;
  
  // Show only the visible (non-trimmed) portion
  const clipWidth = isTrimmableClip ? (outPoint - inPoint) * pixelsPerSecond : clip.duration * pixelsPerSecond;
  const clipLeft = clip.startTime * pixelsPerSecond;

  const generateWaveform = useCallback(() => {
    const bars = Math.floor(clipWidth / 3);
    const data = [];
    for (let i = 0; i < bars; i++) {
      data.push(Math.random() * 0.8 + 0.1);
    }
    setWaveformData(data);
  }, [clipWidth]);

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
    const isTrimmableClip = clip.type === 'sound' || clip.type === 'background';
    
    if (isTrimmableClip) {
      // Non-destructive editing for sound/background clips - only show visible portion
      const inPoint = clip.inPoint || 0;
      const outPoint = clip.outPoint || clip.duration;
      const visibleDuration = outPoint - inPoint;
      
      waveformData.forEach((amplitude, i) => {
        const x = i * barWidth;
        const barHeight = amplitude * height * 0.9;
        const y = (height - barHeight) / 2;
        
        const barProgress = i / waveformData.length;
        const barStartTime = clipStart + barProgress * visibleDuration;
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
    } else {
      // Simple waveform for TTS clips
      waveformData.forEach((amplitude, i) => {
        const x = i * barWidth;
        const barHeight = amplitude * height * 0.9;
        const y = (height - barHeight) / 2;
        
        const barProgress = x / clipWidth;
        const barStartTime = clipStart + barProgress * (clip.duration || 0);
        const isActive = isTimelinePlaying && currentPlayTime >= clipStart && currentPlayTime <= clipEnd && currentPlayTime >= barStartTime;
        
        if (isActive) {
          const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
          ctx.fillStyle = `rgba(0, 255, 100, ${pulse})`;
          const animatedHeight = barHeight * (1 + pulse * 0.5);
          const animatedY = (height - animatedHeight) / 2;
          ctx.fillRect(x, animatedY, barWidth - 0.5, animatedHeight);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(x, y, barWidth - 0.5, barHeight);
        }
      });
    }
  }, [waveformData, playhead, isTimelinePlaying, clip.startTime, clip.duration, clip.inPoint, clip.outPoint, clip.originalDuration, clip.type, clipWidth]);

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
    setIsDragging(true);
    setDragStart({ x: e.clientX, startTime: clip.startTime });
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
    <div
      className={`audio-clip ${clip.type}-clip ${isSelected ? 'selected' : ''}`}
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
            className="trim-handle trim-start"
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
            className="trim-handle trim-end"
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
      
      <div className="clip-content">
        <div className="clip-header">
          <button 
            className="clip-play-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (isClipPlaying) {
                // Stop individual clip playback
                if (clipAudioRef.current) {
                  clipAudioRef.current.pause();
                  clipAudioRef.current = null;
                }
                setIsClipPlaying(false);
              } else {
                // Play only this clip (not the mix)
                if (clip.audioData) {
                  // Stop other individual clips but not timeline mix
                  document.querySelectorAll('.clip-audio').forEach(a => {
                    a.pause();
                    a.remove();
                  });
                  
                  const audio = new Audio(clip.audioData);
                  audio.className = 'clip-audio';
                  audio.volume = clip.volume || 1.0;
                  const inPoint = clip.inPoint || 0;
                  const outPoint = clip.outPoint || clip.originalDuration || clip.duration;
                  
                  audio.currentTime = inPoint;
                  
                  // Set up listener to stop at outPoint
                  const checkTime = () => {
                    if (audio.currentTime >= outPoint) {
                      audio.pause();
                      setIsClipPlaying(false);
                    }
                  };
                  audio.addEventListener('timeupdate', checkTime);
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
          <div className="clip-name">{clip.name}</div>
          <button 
            className="clip-settings-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            title="Clip Settings"
          >
            ⚙️
          </button>
        </div>
        <div className="clip-waveform">
          <canvas 
            ref={canvasRef}
            width={clipWidth}
            height={30}
            style={{ width: '100%', height: '100%' }}
          />
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
    </div>
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
    <div className="clip-properties">
      <h4>{clip.name}</h4>
      
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
      
      <button onClick={onDelete} className="delete-clip-btn">🗑️ Delete Clip</button>
    </div>
  );
}

function SoundPicker({ onSelect, onClose }) {
  const [sounds, setSounds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSounds();
  }, []);

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

  return (
    <div className="sound-picker-overlay">
      <div className="sound-picker-modal">
        <div className="picker-header">
          <h4>Select Background Sound</h4>
          <button onClick={onClose}>×</button>
        </div>
        
        <input
          type="text"
          placeholder="Search sounds..."
          value={searchTerm}
          onChange={handleSearch}
          className="sound-search"
        />
        
        {loading && <div className="loading">Searching...</div>}
        
        <div className="sounds-list">
          {sounds.map(sound => (
            <div key={sound.id} className="sound-item">
              <span>{sound.name}</span>
              <div className="sound-actions">
                <button 
                  onClick={() => {
                    const audio = new Audio(sound.url);
                    audio.play().catch(console.error);
                  }}
                >
                  ▶️
                </button>
                <button onClick={() => onSelect(sound)}>Add</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AudioTimeline;