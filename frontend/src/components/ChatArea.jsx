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
      
      const { user_message } = response.data;
      setMessages(prev => [...prev, user_message]);
      
      // Auto-play TTS if available
      if (user_message && user_message.audio_data) {
        try {
          // Stop any currently playing audio
          document.querySelectorAll('audio').forEach(a => {
            a.pause();
            a.currentTime = 0;
          });
          
          const audio = new Audio(user_message.audio_data);
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[85vh]">
      {/* Messages Area - Takes 2 columns */}
      <div className="lg:col-span-2 bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200 flex flex-col">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Conversation</h2>
        <div className="flex-1 overflow-y-auto pr-4 -mr-4 scrollbar-thin" style={{maxHeight: 'calc(85vh - 120px)'}}>
          {messages.filter(message => message.sender === 'user').map((message, index) => (
            <div key={index} className="mb-2 group">
              <div className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs mt-0.5">
                      {(message.character_name || 'U')[0]}
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 text-base">
                        {message.character_name}:
                      </span>
                      <span className="text-gray-700 ml-2">
                        {message.text}
                      </span>
                    </div>
                  </div>
                  {message.audio_data && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button 
                        className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors duration-200 text-sm"
                        onClick={() => {
                          document.querySelectorAll('audio').forEach(a => {
                            a.pause();
                            a.currentTime = 0;
                          });
                          const audio = new Audio(message.audio_data);
                          audio.play().catch(e => console.error('Audio play error:', e));
                        }}
                        title="Listen"
                      >
                        🔊
                      </button>
                      <button 
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200"
                        onClick={() => {
                          const audio = new Audio(message.audio_data);
                          audio.addEventListener('loadedmetadata', () => {
                            const ttsClips = mixerTracks.filter(t => t.type === 'tts' || t.type === 'sound');
                            const lastEndTime = ttsClips.length > 0 
                              ? Math.max(...ttsClips.map(t => (t.startTime || 0) + (t.duration || 0)))
                              : 0;
                            
                            const newTrack = {
                              id: Date.now(),
                              name: `${message.character_name}: ${message.text.substring(0, 30)}...`,
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
                        title="Add to Timeline"
                      >
                        + Timeline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Controls - Takes 1 column */}
      <div className="bg-white rounded-3xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200 flex flex-col h-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Message</h2>
        
        <div className="space-y-4 flex-1 flex flex-col justify-between">
          <div>
            <label className="block font-semibold text-gray-700 mb-2">
              Character
            </label>
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 font-medium transition-all duration-200 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 hover:border-gray-300"
            >
              {characters.map((character, index) => (
                <option key={index} value={character.name}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-2">
              Rephrase Tags (Optional)
            </label>
            <input
              type="text"
              value={rephraseTags}
              onChange={(e) => setRephraseTags(e.target.value)}
              placeholder="dramatic, intense, funny, etc."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 hover:border-gray-300 placeholder-gray-500"
            />
          </div>

          {availableStyles.length > 0 && (
            <div>
              <label className="block font-semibold text-gray-700 mb-2">
                Voice Style for {selectedCharacter}
              </label>
              <select
                value={selectedVoiceStyle}
                onChange={(e) => setSelectedVoiceStyle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 font-medium transition-all duration-200 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 hover:border-gray-300"
              >
                <option value="">Select voice style</option>
                {availableStyles.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            <label className="block font-semibold text-gray-700 mb-2">
              Message
            </label>
            <div className="flex gap-3 flex-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Enter text as ${selectedCharacter}...`}
                rows="4"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl resize-none bg-white text-gray-900 transition-all duration-200 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 hover:border-gray-300 placeholder-gray-500"
              />
              <div className="flex flex-col justify-end">
                <button 
                  onClick={handleRephrase} 
                  disabled={!inputText.trim()}
                  className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium text-sm transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap mb-4"
                >
                  Rephrase
                </button>
                <button 
                  onClick={sendMessage} 
                  disabled={!inputText.trim()}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatArea;