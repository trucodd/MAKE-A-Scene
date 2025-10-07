import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function ChatArea({ characters, mixerTracks, onTracksChange }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('Narrator');
  const [selectedVoiceStyle, setSelectedVoiceStyle] = useState('');
  const [availableStyles, setAvailableStyles] = useState([]);
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API_BASE}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const [rephraseTags, setRephraseTags] = useState('');

  const handleRephrase = async () => {
    if (!inputText.trim()) return;

    try {
      const response = await axios.post(`${API_BASE}/rephrase`, {
        text: inputText,
        character_name: selectedCharacter,
        tags: rephraseTags || null
      });
      setInputText(response.data.rephrased_text);
    } catch (error) {
      console.error('Error rephrasing text:', error);
    }
  };

  useEffect(() => {
    fetchVoices();
  }, []);

  useEffect(() => {
    const character = characters.find(c => c.name === selectedCharacter);
    if (character && voices.length > 0) {
      const voice = voices.find(v => v.voiceId === character.voice_id);
      setAvailableStyles(voice?.availableStyles || []);
    } else {
      setAvailableStyles([]);
    }
    setSelectedVoiceStyle('');
  }, [selectedCharacter, voices, characters]);

  const fetchVoices = async () => {
    try {
      const response = await axios.get(`${API_BASE}/voices`);
      setVoices(response.data);
    } catch (error) {
      console.error('Error fetching voices:', error);
    }
  };



  const sendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      const response = await axios.post(`${API_BASE}/send`, {
        text: inputText,
        character_name: selectedCharacter,
        voice_style: selectedVoiceStyle
      });
      
      const { user_message, bot_response } = response.data;
      setMessages(prev => [...prev, user_message, bot_response]);
      
      // Auto-play TTS if available
      if (bot_response && bot_response.audio_data) {
        try {
          // Stop any currently playing audio
          document.querySelectorAll('audio').forEach(a => {
            a.pause();
            a.currentTime = 0;
          });
          
          const audio = new Audio(bot_response.audio_data);
          audio.play().catch(e => console.error('Audio play error:', e));
        } catch (e) {
          console.error('Audio creation error:', e);
        }
      }
      
      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-[85vh] gap-4">
      <div className="flex-1 overflow-y-auto border border-purple-500/30 rounded-2xl p-8 bg-gradient-to-br from-black/60 via-purple-900/20 to-green-900/20 backdrop-blur-sm shadow-inner shadow-black/30 min-h-[500px]">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`mb-6 p-6 rounded-2xl bg-gradient-to-br from-black/60 to-purple-900/30 backdrop-blur-xs transition-all duration-300 hover:translate-x-1 hover:shadow-lg border ${
              message.sender === 'bot' 
                ? 'border-purple-500/30 hover:shadow-purple-500/30 hover:border-purple-400/50' 
                : 'border-green-500/30 hover:shadow-green-500/30 hover:border-green-400/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="font-bold text-base bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
                {message.sender === 'bot' ? 'AI Assistant' : message.character_name}
              </span>
              {message.audio_data && (
                <div className="flex items-center gap-3">
                  <button 
                    className="bg-gradient-to-br from-green-500/20 to-purple-500/20 border border-green-500/30 rounded-lg px-2 py-2 text-green-400 transition-all duration-300 hover:bg-gradient-to-br hover:from-green-500/30 hover:to-purple-500/30 hover:scale-110 hover:shadow-md hover:shadow-green-500/30"
                    onClick={() => {
                      document.querySelectorAll('audio').forEach(a => {
                        a.pause();
                        a.currentTime = 0;
                      });
                      const audio = new Audio(message.audio_data);
                      audio.play().catch(e => console.error('Audio play error:', e));
                    }}
                    title="Play Audio"
                  >
                    🔊
                  </button>
                  {message.audio_id && (
                    <button 
                      className="bg-gradient-to-r from-cyan-600 to-cyan-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-cyan-500/40"
                      onClick={() => {
                        const audio = new Audio(message.audio_data);
                        audio.addEventListener('loadedmetadata', () => {
                          const ttsClips = mixerTracks.filter(t => t.type === 'tts' || t.type === 'sound');
                          const lastEndTime = ttsClips.length > 0 
                            ? Math.max(...ttsClips.map(t => (t.startTime || 0) + (t.duration || 0)))
                            : 0;
                          
                          const newTrack = {
                            id: Date.now(),
                            name: `${message.character_name || 'Bot'}: ${message.text.substring(0, 30)}...`,
                            audioData: message.audio_data,
                            volume: 1.0,
                            type: 'tts',
                            duration: audio.duration || 3.0,
                            startTime: lastEndTime
                          };
                          onTracksChange(prev => [...prev, newTrack]);
                        });
                        alert('Audio added to timeline! Go to Timeline Editor tab to edit.');
                      }}
                      title="Add to Timeline Editor"
                    >
                      ➕ Timeline
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="text-white/90 leading-relaxed text-lg">
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-purple-500/30 rounded-2xl p-6 bg-gradient-to-br from-black/80 via-purple-900/40 to-green-900/20 backdrop-blur-sm shadow-2xl shadow-purple-500/20">
        <div className="flex items-center gap-6 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="font-semibold text-green-400 text-base">
              Character:
            </label>
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
              className="px-4 py-3 border-2 border-purple-500/30 rounded-lg bg-black/50 text-white text-base font-medium transition-all duration-300 focus:outline-none focus:border-green-400 focus:shadow-md focus:shadow-green-400/30"
            >
              {characters.map((character, index) => (
                <option key={index} value={character.name}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={rephraseTags}
            onChange={(e) => setRephraseTags(e.target.value)}
            placeholder="Rephrase tags (optional): dramatic, intense, funny, etc."
            className="w-full p-4 border-2 border-purple-500/30 rounded-xl text-base bg-black/50 text-white transition-all duration-300 focus:outline-none focus:border-green-400 focus:shadow-lg focus:shadow-green-400/30 placeholder-white/50"
          />
        </div>

        {availableStyles.length > 0 && (
          <div className="mb-4">
            <label className="block text-green-400 font-semibold mb-3">
              Voice Style for {selectedCharacter} (optional):
            </label>
            <div className="flex gap-3 flex-wrap">
              {availableStyles.map(style => (
                <button
                  key={style}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-xs ${
                    selectedVoiceStyle === style
                      ? 'bg-gradient-to-r from-purple-600 to-green-500 text-white font-bold shadow-md shadow-green-400/40'
                      : 'bg-gradient-to-br from-purple-900/20 to-black/40 text-white/80 border border-purple-500/30 hover:bg-gradient-to-br hover:from-purple-600/30 hover:to-green-500/20 hover:border-green-400/50 hover:-translate-y-0.5'
                  }`}
                  onClick={() => setSelectedVoiceStyle(selectedVoiceStyle === style ? '' : style)}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4 items-end">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Enter text as ${selectedCharacter}...`}
            rows="3"
            className="flex-1 p-4 border-2 border-purple-500/30 rounded-xl resize-vertical text-base bg-black/50 text-white transition-all duration-300 focus:outline-none focus:border-green-400 focus:shadow-lg focus:shadow-green-400/30 placeholder-white/50 min-h-[120px]"
          />
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleRephrase} 
              disabled={!inputText.trim()}
              className="bg-gradient-to-r from-green-500 to-green-400 text-white px-6 py-4 rounded-xl font-semibold text-base min-w-[120px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-400/40 disabled:bg-gradient-to-br disabled:from-gray-600/50 disabled:to-gray-700/50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              Rephrase
            </button>
            <button 
              onClick={sendMessage} 
              disabled={!inputText.trim()}
              className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 rounded-xl font-semibold text-base min-w-[120px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/40 disabled:bg-gradient-to-br disabled:from-gray-600/50 disabled:to-gray-700/50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatArea;