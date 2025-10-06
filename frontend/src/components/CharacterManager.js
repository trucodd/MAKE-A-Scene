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
    <div className="character-manager">
      <h2>Character Management</h2>
      
      <form onSubmit={handleSubmit} className="character-form">
        <div className="form-group">
          <label htmlFor="name">Character Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter character name"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Character Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the character's personality, traits, and how they should behave..."
            rows="4"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="voiceId">Voice:</label>
          <select
            id="voiceId"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
          >
            <option value="">Select Voice</option>
            {voices.map(voice => (
              <option key={voice.voiceId} value={voice.voiceId}>
                {voice.displayName}
              </option>
            ))}
          </select>
        </div>
        

        
        <div className="form-buttons">
          <button type="submit" className="create-btn">
            {editingCharacter ? 'Update Character' : 'Create Character'}
          </button>
          {editingCharacter && (
            <button type="button" className="cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
      
      <div className="characters-list">
        <h3>Existing Characters</h3>
        {characters.length === 0 ? (
          <p>No characters created yet.</p>
        ) : (
          <div className="character-cards">
            {characters.map((character, index) => (
              <div key={index} className="character-card">
                <h4>{character.name}</h4>
                <p>{character.description}</p>
                <div className="voice-info">
                  <small>Voice: {character.voice_id}</small>
                </div>
                <button 
                  className="edit-btn"
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