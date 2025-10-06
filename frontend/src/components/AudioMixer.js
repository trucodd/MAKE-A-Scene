import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AudioTimeline from './AudioTimeline';

const API_BASE = 'http://localhost:8000';

function AudioMixer({ tracks, onTracksChange, onClose }) {
  const [backgroundSounds, setBackgroundSounds] = useState([]);
  const [showSoundSelector, setShowSoundSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [mainTrackVolume, setMainTrackVolume] = useState(1.0);

  // Separate TTS and background tracks
  const ttsAudios = tracks.filter(track => track.type === 'tts');
  const backgroundTracks = tracks.filter(track => track.type === 'background');

  useEffect(() => {
    fetchBackgroundSounds();
  }, []);

  const fetchBackgroundSounds = async (query = '') => {
    setLoading(true);
    try {
      const url = query ? `${API_BASE}/background-sounds?search=${encodeURIComponent(query)}` : `${API_BASE}/background-sounds`;
      const response = await axios.get(url);
      setBackgroundSounds(response.data);
    } catch (error) {
      console.error('Error fetching background sounds:', error);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    if (query.length > 2) {
      fetchBackgroundSounds(query);
    } else if (query.length === 0) {
      fetchBackgroundSounds();
    }
  };

  const addBackgroundTrack = (sound, insertAfter = null, overlayType = "normal") => {
    const newTrack = {
      id: Date.now(),
      name: sound.name,
      audioData: sound.url,
      volume: 0.5,
      type: 'background',
      insertAfter: insertAfter, // null for overlay, number for insert after TTS clip
      overlayType: overlayType,
      position: 0
    };
    onTracksChange([...tracks, newTrack]);
  };

  const [selectedOverlayType, setSelectedOverlayType] = useState("normal");

  const [insertPosition, setInsertPosition] = useState(null);
  const [playingAudios, setPlayingAudios] = useState(new Map()); // Track playing audio instances

  const toggleAudio = (audioId, audioData, volume = 1.0) => {
    if (playingAudios.has(audioId)) {
      // Stop audio
      const audio = playingAudios.get(audioId);
      audio.pause();
      audio.currentTime = 0;
      const newPlayingAudios = new Map(playingAudios);
      newPlayingAudios.delete(audioId);
      setPlayingAudios(newPlayingAudios);
    } else {
      // Start audio
      const audio = new Audio(audioData);
      audio.volume = volume;
      audio.onended = () => {
        const newPlayingAudios = new Map(playingAudios);
        newPlayingAudios.delete(audioId);
        setPlayingAudios(newPlayingAudios);
      };
      audio.play().catch(console.error);
      const newPlayingAudios = new Map(playingAudios);
      newPlayingAudios.set(audioId, audio);
      setPlayingAudios(newPlayingAudios);
    }
  };

  const stopAllAudio = () => {
    playingAudios.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    setPlayingAudios(new Map());
  };

  const updateTrackVolume = (trackId, volume) => {
    onTracksChange(tracks.map(track => 
      track.id === trackId ? { ...track, volume } : track
    ));
  };

  const removeTrack = (trackId) => {
    onTracksChange(tracks.filter(track => track.id !== trackId));
  };

  const playPreview = async () => {
    try {
      // Stop all current audio
      stopAllAudio();
      
      // Prepare tracks for backend mixing
      const tracksForMixing = tracks.map(track => ({
        id: track.id,
        name: track.name,
        audioData: track.audioData,
        volume: track.type === 'tts' ? mainTrackVolume : track.volume,
        type: track.type,
        insertAfter: track.insertAfter || null
      }));
      
      // Call backend to mix audio
      const response = await axios.post(`${API_BASE}/mix-audio-tracks`, {
        tracks: tracksForMixing
      });
      
      if (response.data.mixed_audio_data) {
        const mixedAudio = new Audio(response.data.mixed_audio_data);
        mixedAudio.onended = () => {
          const newPlayingAudios = new Map(playingAudios);
          newPlayingAudios.delete('preview-mix');
          setPlayingAudios(newPlayingAudios);
        };
        mixedAudio.play().catch(console.error);
        
        const newPlayingAudios = new Map(playingAudios);
        newPlayingAudios.set('preview-mix', mixedAudio);
        setPlayingAudios(newPlayingAudios);
      }
    } catch (error) {
      console.error('Error mixing audio:', error);
      alert('Error mixing audio. Using fallback playback.');
      
      // Fallback to sequential playback
      if (ttsAudios.length > 0) {
        let currentIndex = 0;
        const playNext = () => {
          if (currentIndex < ttsAudios.length) {
            const audio = new Audio(ttsAudios[currentIndex].audioData);
            audio.volume = mainTrackVolume;
            audio.onended = () => {
              currentIndex++;
              playNext();
            };
            audio.play().catch(console.error);
          }
        };
        playNext();
      }
    }
  };

  return (
    <div className="audio-mixer">
      <div className="mixer-header">
        <h3>🎛️ Audio Mixer</h3>
      </div>

      <div className="mixer-content">
        {tracks.length === 0 && (
          <div className="empty-mixer">
            <p>No audio tracks added yet.</p>
            <p>Go to the Chat tab and click "➕ Mixer" on TTS messages to add them here.</p>
          </div>
        )}

      {/* Main TTS Track (Combined) */}
      {ttsAudios.length > 0 && (
        <div className="audio-track main-track">
          <div className="track-header">
            <span>Main Audio ({ttsAudios.length} TTS clips)</span>
            <button onClick={() => {
              const mainTrackId = 'main-track';
              if (playingAudios.has(mainTrackId)) {
                // Stop main track
                const audio = playingAudios.get(mainTrackId);
                audio.pause();
                const newPlayingAudios = new Map(playingAudios);
                newPlayingAudios.delete(mainTrackId);
                setPlayingAudios(newPlayingAudios);
              } else {
                // Play all TTS audios sequentially
                let currentIndex = 0;
                const playNext = () => {
                  if (currentIndex < ttsAudios.length) {
                    const audio = new Audio(ttsAudios[currentIndex].audioData);
                    audio.volume = mainTrackVolume;
                    audio.onended = () => {
                      currentIndex++;
                      if (currentIndex >= ttsAudios.length) {
                        const newPlayingAudios = new Map(playingAudios);
                        newPlayingAudios.delete(mainTrackId);
                        setPlayingAudios(newPlayingAudios);
                      } else {
                        playNext();
                      }
                    };
                    audio.play().catch(console.error);
                    if (currentIndex === 0) {
                      const newPlayingAudios = new Map(playingAudios);
                      newPlayingAudios.set(mainTrackId, audio);
                      setPlayingAudios(newPlayingAudios);
                    }
                  }
                };
                playNext();
              }
            }}>
              {playingAudios.has('main-track') ? '⏹️' : '▶️'}
            </button>
            <button onClick={() => {
              // Remove all TTS tracks
              onTracksChange(backgroundTracks);
            }}>🗑️</button>
          </div>
          <div className="main-waveform-container">
            {ttsAudios.map((audio, index) => (
              <React.Fragment key={audio.id}>
                <div className="waveform-segment" style={{ flex: 1 }}>
                  <div className="segment-label">TTS {index + 1}</div>
                  <div className="segment-waveform"></div>
                </div>
                {index < ttsAudios.length - 1 && (
                  <button 
                    className="insert-sound-btn"
                    onClick={() => {
                      setInsertPosition(index);
                      setShowSoundSelector(true);
                    }}
                    title="Insert sound after this clip"
                  >
                    +
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="volume-control">
            <div className="volume-info">
              <label>Master Volume</label>
              <span className="volume-value">{Math.round(mainTrackVolume * 100)}%</span>
              <span className="volume-db">{(20 * (mainTrackVolume - 1)).toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={mainTrackVolume}
              onChange={(e) => setMainTrackVolume(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
      )}

      {/* Background Tracks - Horizontal Layout */}
      {backgroundTracks.filter(track => track.insertAfter === null).length > 0 && (
        <div className="background-tracks-row">
          <div className="row-header">Background Sounds</div>
          <div className="tracks-horizontal">
            {backgroundTracks.filter(track => track.insertAfter === null).map(track => (
              <div key={track.id} className="audio-track-horizontal">
                <div className="track-name">{track.name}</div>
                <div className="track-controls">
                  <button onClick={() => toggleAudio(track.id, track.audioData, track.volume)}>
                    {playingAudios.has(track.id) ? '⏹️' : '▶️'}
                  </button>
                  <button onClick={() => removeTrack(track.id)}>🗑️</button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={track.volume}
                  onChange={(e) => updateTrackVolume(track.id, parseFloat(e.target.value))}
                  className="volume-slider-small"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overlay Tracks - Vertical Layout */}
      {backgroundTracks.filter(track => track.insertAfter !== null).map(track => (
        <div key={track.id} className="audio-track overlay-track">
          <div className="track-header">
            <span>
              {track.name}
              <span className="insert-indicator"> (After Clip {track.insertAfter + 1})</span>
              <span className="overlay-type-badge">{track.overlayType}</span>
            </span>
            <button onClick={() => toggleAudio(track.id, track.audioData, track.volume)}>
              {playingAudios.has(track.id) ? '⏹️' : '▶️'}
            </button>
            <button onClick={() => removeTrack(track.id)}>🗑️</button>
          </div>
          <div className="waveform-bar overlay-waveform"></div>
          <div className="volume-control">
            <div className="volume-info">
              <label>BG Volume</label>
              <span className="volume-value">{Math.round(track.volume * 100)}%</span>
              <span className="volume-db">{(20 * (track.volume - 1)).toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={track.volume}
              onChange={(e) => updateTrackVolume(track.id, parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
      ))}

      {/* Add Background Sound Button */}
      <div className="add-sound-section">
        <button 
          className="add-sound-btn"
          onClick={() => {
            setInsertPosition(null);
            setShowSoundSelector(!showSoundSelector);
          }}
        >
          {showSoundSelector ? '➖ Close Sound Library' : '🎵 Add Background Sound'}
        </button>
        {!showSoundSelector && (
          <p className="add-sound-hint">
            Click to browse and add background music, ambient sounds, or effects
          </p>
        )}
      </div>

      {/* Sound Selector */}
      {showSoundSelector && (
        <div className="sound-selector">
          <div className="selector-header">
            <h4>
              {insertPosition !== null 
                ? `🎵 Insert Sound After Clip ${insertPosition + 1}` 
                : '🎵 Add Background Sound (Overlay)'}
            </h4>
            <button 
              className="close-selector"
              onClick={() => {
                setShowSoundSelector(false);
                setInsertPosition(null);
              }}
            >
              ×
            </button>
          </div>
          
          <div className="search-section">
            <input
              type="text"
              placeholder="🔍 Search sounds (rain, forest, city, music)..."
              value={searchTerm}
              onChange={handleSearch}
              className="sound-search"
            />
            
            <div className="overlay-type-selector">
              <label>Overlay Effect:</label>
              <select 
                value={selectedOverlayType} 
                onChange={(e) => setSelectedOverlayType(e.target.value)}
                className="overlay-select"
              >
                <option value="normal">Normal</option>
                <option value="fade_in">Fade In</option>
                <option value="fade_out">Fade Out</option>
                <option value="crossfade">Crossfade</option>
              </select>
            </div>
            
            {loading && <div className="loading">🔄 Searching...</div>}
          </div>
          
          <div className="sounds-grid">
            {backgroundSounds.length === 0 && !loading && (
              <div className="no-sounds">No sounds found. Try a different search term.</div>
            )}
            {backgroundSounds.map(sound => (
              <div key={sound.id} className="sound-card">
                <div className="sound-name">{sound.name}</div>
                <div className="sound-actions">
                  <button
                    className="preview-sound-btn"
                    onClick={() => toggleAudio(`preview-${sound.id}`, sound.url, 0.3)}
                    title="Preview sound"
                  >
                    {playingAudios.has(`preview-${sound.id}`) ? '⏹️' : '▶️'}
                  </button>
                  <button
                    className="add-sound-btn-small"
                    onClick={() => {
                      addBackgroundTrack(sound, insertPosition, selectedOverlayType);
                      setShowSoundSelector(false);
                      setInsertPosition(null);
                    }}
                    title={insertPosition !== null ? `Insert after clip ${insertPosition + 1}` : 'Add as background overlay'}
                  >
                    {insertPosition !== null ? '➕ Insert' : '➕ Add'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CapCut-style Timeline Editor */}
      {tracks.length > 0 && (
        <div className="timeline-section">
          <h4>🎥 Timeline Editor</h4>
          <AudioTimeline 
            tracks={tracks.map((track, index) => {
              // Calculate proper start time for TTS clips to be concatenated
              let calculatedStartTime = track.startTime;
              
              if (track.type === 'tts' && calculatedStartTime === undefined) {
                // Find the end time of the last TTS clip
                const previousTtsClips = tracks
                  .filter((t, i) => t.type === 'tts' && i < index)
                  .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                
                if (previousTtsClips.length === 0) {
                  calculatedStartTime = 0; // First clip starts at 0
                } else {
                  const lastClip = previousTtsClips[previousTtsClips.length - 1];
                  calculatedStartTime = (lastClip.startTime || 0) + (lastClip.duration || 3.0);
                }
              }
              
              return {
                ...track,
                startTime: calculatedStartTime || 0,
                duration: track.duration || 3.0
              };
            })}
            onTracksChange={onTracksChange}
          />
        </div>
      )}

      {/* Controls */}
      <div className="mixer-controls">
        <button 
          onClick={playPreview} 
          className="preview-btn"
          disabled={tracks.length === 0}
        >
          {playingAudios.has('preview-mix') ? '⏹️ Stop Preview' : '🔊 Preview Mix'}
        </button>
        <button onClick={stopAllAudio} className="stop-all-btn">⏹️ Stop All</button>
      </div>
      </div>
    </div>
  );
}

export default AudioMixer;