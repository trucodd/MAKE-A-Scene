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
    <div className="chat-area">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender === 'bot' ? 'bot' : message.message_type}`}>
            <div className="message-header">
              <span className="message-type">
                {message.sender === 'bot' ? 'Bot' : message.character_name}
              </span>
              {message.audio_data && (
                <div className="audio-controls">
                  <button 
                    className="tts-btn"
                    onClick={() => {
                      // Stop any currently playing audio
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
                      className="add-to-mixer-btn"
                      onClick={() => {
                        // Get actual audio duration
                        const audio = new Audio(message.audio_data);
                        audio.addEventListener('loadedmetadata', () => {
                          const newTrack = {
                            id: Date.now(), // Unique ID for each track
                            name: `${message.character_name || 'Bot'}: ${message.text.substring(0, 30)}...`,
                            audioData: message.audio_data,
                            volume: 1.0,
                            type: 'tts',
                            duration: audio.duration || 3.0
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
            <div className="message-content">
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <div className="input-controls">
          <div className="character-selector">
            <label>Character:</label>
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
            >
              {characters.map((character, index) => (
                <option key={index} value={character.name}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rephrase-tags">
          <input
            type="text"
            value={rephraseTags}
            onChange={(e) => setRephraseTags(e.target.value)}
            placeholder="Rephrase tags (optional): dramatic, intense, funny, etc."
            className="tags-input"
          />
        </div>

        {availableStyles.length > 0 && (
          <div className="voice-styles">
            <label>Voice Style for {selectedCharacter} (optional):</label>
            <div className="style-tags">
              {availableStyles.map(style => (
                <button
                  key={style}
                  className={`style-tag ${selectedVoiceStyle === style ? 'selected' : ''}`}
                  onClick={() => setSelectedVoiceStyle(selectedVoiceStyle === style ? '' : style)}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="input-row">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Enter text as ${selectedCharacter}...`}
            rows="3"
          />
          <div className="button-group">
            <button onClick={handleRephrase} disabled={!inputText.trim()}>
              Rephrase
            </button>
            <button onClick={sendMessage} disabled={!inputText.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
      

    </div>
  );
}

export default ChatArea;