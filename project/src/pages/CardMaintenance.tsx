import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { CardForm } from '../components/CardForm';
import { loadCards, saveCard } from '../services/cardService';
import type { ArchiveCard } from '../types/Card';

interface LocationState {
  selectedCardIndex?: number;
}

export function CardMaintenance() {
  const location = useLocation();
  const { selectedCardIndex } = (location.state as LocationState) || {};
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cards, setCards] = useState<ArchiveCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards().then((loadedCards) => {
      setCards(loadedCards);
      if (selectedCardIndex !== undefined) {
        setCurrentIndex(selectedCardIndex);
      }
      setLoading(false);
    });
  }, [selectedCardIndex]);

  // Rest of the component remains the same...
  const handlePrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(cards.length - 1, prev + 1));
  };

  const handleChange = (field: keyof ArchiveCard, value: any) => {
    setCards(prevCards => {
      const newCards = [...prevCards];
      newCards[currentIndex] = {
        ...newCards[currentIndex],
        [field]: value
      };
      return newCards;
    });
  };

  const handleNewCard = () => {
    const today = new Date().toISOString().split('T')[0];
    
    const newCard: ArchiveCard = {
      id: (cards.length + 1).toString(),
      objectName: '',
      idNumber: '',
      title: '',
      dateReceived: today,
      briefDescription: '',
      donatedBy: '',
      donationDate: today,
      copyright: '',
      associatedPeople: [],
      associatedPlaces: [],
      homeLocation: '',
      homeLocationDate: today,
      currentLocation: '',
      currentLocationDate: today,
      physicalDescription: '',
      size: '',
      condition: '',
      notes: '',
      crossReferences: ''
    };
    setCards([...cards, newCard]);
    setCurrentIndex(cards.length);
  };

  const handleSave = async () => {
    const success = await saveCard(cards[currentIndex]);
    if (success) {
      alert('Card saved successfully!');
    } else {
      alert('Failed to save card');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
      setCards(prevCards => {
        const newCards = prevCards.filter((_, index) => index !== currentIndex);
        return newCards;
      });
      setCurrentIndex(prev => Math.min(prev, cards.length - 2));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading cards...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className="text-sm text-gray-500">
            Card {currentIndex + 1} of {cards.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
            className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={handleNewCard}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            New
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <Save className="h-5 w-5 mr-2" />
            Save
          </button>
        </div>
      </div>

      {cards.length > 0 && (
        <>
          <CardForm
            data={cards[currentIndex]}
            onChange={handleChange}
          />
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Delete Card
            </button>
          </div>
        </>
      )}
    </div>
  );
}