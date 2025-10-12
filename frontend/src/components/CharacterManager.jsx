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
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Character Management
        </h2>
        <p className="text-gray-600">Create and manage your story characters</p>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-gradient-to-br from-white to-purple-50/40 rounded-3xl p-8 mb-8 card-shadow hover:card-shadow-hover transition-all duration-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="name" className="block mb-2 font-semibold text-gray-700">
              Character Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter character name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 hover:border-gray-300 placeholder-gray-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="voiceId" className="block mb-2 font-semibold text-gray-700">
              Voice
            </label>
            <select
              id="voiceId"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 font-medium transition-all duration-200 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 hover:border-gray-300"
            >
              <option value="">Select Voice</option>
              {voices.map(voice => (
                <option key={voice.voiceId} value={voice.voiceId}>
                  {voice.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mb-6">
          <label htmlFor="description" className="block mb-2 font-semibold text-gray-700">
            Character Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the character's personality, traits, and how they should behave..."
            rows="4"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 hover:border-gray-300 placeholder-gray-500 resize-vertical"
            required
          />
        </div>
        
        <div className="flex gap-3 justify-center">
          <button 
            type="submit" 
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5"
          >
            {editingCharacter ? 'Update Character' : 'Create Character'}
          </button>
          {editingCharacter && (
            <button 
              type="button" 
              className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-6">
          Your Characters
        </h3>
        {characters.length === 0 ? (
          <div className="bg-gradient-to-br from-white to-gray-50/40 rounded-3xl p-12 text-center card-shadow">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p className="text-gray-500 text-lg">No characters created yet.</p>
            <p className="text-gray-400 text-sm mt-2">Create your first character to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character, index) => (
              <div 
                key={index} 
                className="bg-gradient-to-br from-white to-indigo-50/30 rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {character.name[0]}
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">
                    {character.name}
                  </h4>
                </div>
                <p className="text-gray-600 leading-relaxed mb-4 text-sm">
                  {character.description}
                </p>
                <div className="mb-4">
                  <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                    Voice: {character.voice_id}
                  </span>
                </div>
                <button 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:-translate-y-0.5"
                  onClick={() => handleEdit(character)}
                >
                  Edit Character
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