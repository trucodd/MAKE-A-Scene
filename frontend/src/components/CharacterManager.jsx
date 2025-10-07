import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function CharacterManager({ characters, onCreateCharacter, voices }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [editingCharacter, setEditingCharacter] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && description.trim()) {
      if (editingCharacter) {
        updateCharacter(editingCharacter.name, name.trim(), description.trim(), voiceId);
        setEditingCharacter(null);
      } else {
        onCreateCharacter(name.trim(), description.trim(), voiceId);
      }
      setName('');
      setDescription('');
      setVoiceId('');
    }
  };

  const updateCharacter = async (characterName, newName, newDescription, newVoiceId) => {
    try {
      await axios.put(`${API_BASE}/characters/${characterName}`, {
        name: newName,
        description: newDescription,
        voice_id: newVoiceId
      });
      window.location.reload(); // Simple refresh to update characters
    } catch (error) {
      console.error('Error updating character:', error);
    }
  };

  const handleEdit = (character) => {
    setEditingCharacter(character);
    setName(character.name);
    setDescription(character.description);
    setVoiceId(character.voice_id);
  };

  const handleCancel = () => {
    setEditingCharacter(null);
    setName('');
    setDescription('');
    setVoiceId('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-neon-green to-deep-purple bg-clip-text text-transparent">
        Character Management
      </h2>
      
      <form onSubmit={handleSubmit} className="bg-gradient-to-br from-dark-purple/90 to-dark-blue/90 border border-deep-purple/30 rounded-2xl p-8 mb-10 backdrop-blur-sm shadow-2xl shadow-deep-purple/20">
        <div className="mb-6">
          <label htmlFor="name" className="block mb-2 font-semibold text-neon-green text-base">
            Character Name:
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter character name"
            className="w-full p-4 border-2 border-deep-purple/30 rounded-xl text-base bg-black/50 text-white transition-all duration-300 focus:outline-none focus:border-neon-green focus:shadow-lg focus:shadow-neon-green/30 placeholder-white/50"
            required
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="description" className="block mb-2 font-semibold text-neon-green text-base">
            Character Description:
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the character's personality, traits, and how they should behave..."
            rows="4"
            className="w-full p-4 border-2 border-deep-purple/30 rounded-xl text-base bg-black/50 text-white transition-all duration-300 focus:outline-none focus:border-neon-green focus:shadow-lg focus:shadow-neon-green/30 placeholder-white/50 resize-vertical"
            required
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="voiceId" className="block mb-2 font-semibold text-neon-green text-base">
            Voice:
          </label>
          <select
            id="voiceId"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-full p-4 border-2 border-deep-purple/30 rounded-xl text-base bg-black/50 text-white transition-all duration-300 focus:outline-none focus:border-neon-green focus:shadow-lg focus:shadow-neon-green/30"
          >
            <option value="">Select Voice</option>
            {voices.map(voice => (
              <option key={voice.voiceId} value={voice.voiceId}>
                {voice.displayName}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex gap-4 justify-center">
          <button 
            type="submit" 
            className="bg-gradient-to-r from-neon-green to-green-400 text-black px-8 py-4 rounded-xl font-bold text-base transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neon-green/40"
          >
            {editingCharacter ? 'Update Character' : 'Create Character'}
          </button>
          {editingCharacter && (
            <button 
              type="button" 
              className="bg-gradient-to-br from-gray-600/80 to-gray-700/80 text-white px-8 py-4 border-2 border-deep-purple/30 rounded-xl font-semibold text-base transition-all duration-300 hover:bg-gradient-to-br hover:from-deep-purple/30 hover:to-gray-600/80 hover:-translate-y-0.5"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      
      <div>
        <h3 className="text-neon-green text-2xl font-semibold mb-6 text-center">
          Existing Characters
        </h3>
        {characters.length === 0 ? (
          <p className="text-white/60 text-center text-lg">No characters created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character, index) => (
              <div 
                key={index} 
                className="bg-gradient-to-br from-dark-purple/80 to-dark-blue/80 border border-deep-purple/30 rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-deep-purple/30 hover:border-neon-green/50"
              >
                <h4 className="text-xl font-bold mb-4 bg-gradient-to-r from-neon-green to-deep-purple bg-clip-text text-transparent">
                  {character.name}
                </h4>
                <p className="text-white/80 leading-relaxed mb-4">
                  {character.description}
                </p>
                <div className="mb-4">
                  <small className="text-neon-green/70 text-sm font-medium">
                    Voice: {character.voice_id}
                  </small>
                </div>
                <button 
                  className="bg-gradient-to-r from-deep-purple to-purple-600 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-deep-purple/40"
                  onClick={() => handleEdit(character)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CharacterManager;