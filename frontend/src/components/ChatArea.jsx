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
    <div className="flex flex-col h-[75vh] gap-6">
      <div className="flex-1 overflow-y-auto border border-deep-purple/30 rounded-2xl p-6 bg-gradient-to-br from-dark-purple/60 to-dark-blue/60 backdrop-blur-sm shadow-inner shadow-black/30 scrollbar-thin scrollbar-thumb-gradient-to-r scrollbar-thumb-from-deep-purple scrollbar-thumb-to-neon-green scrollbar-track-black/20">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`mb-5 p-5 rounded-2xl bg-gradient-to-br from-black/40 to-dark-purple/40 backdrop-blur-xs transition-all duration-300 hover:translate-x-1 hover:shadow-lg ${
              message.sender === 'bot' 
                ? 'border-l-4 border-deep-purple hover:shadow-deep-purple/30' 
                : 'border-l-4 border-neon-green hover:shadow-neon-green/30'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="font-bold text-base bg-gradient-to-r from-neon-green to-deep-purple bg-clip-text text-transparent">
                {message.sender === 'bot' ? 'Bot' : message.character_name}
              </span>
              {message.audio_data && (
                <div className="flex items-center gap-3">
                  <button 
                    className="bg-gradient-to-br from-neon-green/20 to-deep-purple/20 border border-neon-green/30 rounded-lg px-2 py-2 text-neon-green transition-all duration-300 hover:bg-gradient-to-br hover:from-neon-green/30 hover:to-deep-purple/30 hover:scale-110 hover:shadow-md hover:shadow-neon-green/30"
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
            <div className="text-white/90 leading-relaxed text-base">
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-deep-purple/30 rounded-2xl p-6 bg-gradient-to-br from-dark-purple/80 to-dark-blue/80 backdrop-blur-sm shadow-2xl shadow-deep-purple/20">
        <div className="flex items-center gap-6 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="font-semibold text-neon-green text-base">
              Character:
            </label>
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
              className="px-4 py-3 border-2 border-deep-purple/30 rounded-lg bg-black/50 text-white text-base font-medium transition-all duration-300 focus:outline-none focus:border-neon-green focus:shadow-md focus:shadow-neon-green/30"
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
            className="w-full p-4 border-2 border-deep-purple/30 rounded-xl text-base bg-black/50 text-white transition-all duration-300 focus:outline-none focus:border-neon-green focus:shadow-lg focus:shadow-neon-green/30 placeholder-white/50"
          />
        </div>

        {availableStyles.length > 0 && (
          <div className="mb-4">
            <label className="block text-neon-green font-semibold mb-3">
              Voice Style for {selectedCharacter} (optional):
            </label>
            <div className="flex gap-3 flex-wrap">
              {availableStyles.map(style => (
                <button
                  key={style}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-xs ${
                    selectedVoiceStyle === style
                      ? 'bg-gradient-to-r from-deep-purple to-neon-green text-black font-bold shadow-md shadow-neon-green/40'
                      : 'bg-gradient-to-br from-deep-purple/20 to-black/40 text-white/80 border border-deep-purple/30 hover:bg-gradient-to-br hover:from-deep-purple/30 hover:to-neon-green/20 hover:border-neon-green/50 hover:-translate-y-0.5'
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
            className="flex-1 p-4 border-2 border-deep-purple/30 rounded-xl resize-vertical text-base bg-black/50 text-white transition-all duration-300 focus:outline-none focus:border-neon-green focus:shadow-lg focus:shadow-neon-green/30 placeholder-white/50 min-h-[120px]"
          />
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleRephrase} 
              disabled={!inputText.trim()}
              className="bg-gradient-to-r from-neon-green to-green-400 text-black px-6 py-4 rounded-xl font-semibold text-base min-w-[120px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neon-green/40 disabled:bg-gradient-to-br disabled:from-gray-600/50 disabled:to-gray-700/50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              Rephrase
            </button>
            <button 
              onClick={sendMessage} 
              disabled={!inputText.trim()}
              className="bg-gradient-to-r from-deep-purple to-purple-600 text-white px-6 py-4 rounded-xl font-semibold text-base min-w-[120px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-deep-purple/40 disabled:bg-gradient-to-br disabled:from-gray-600/50 disabled:to-gray-700/50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
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