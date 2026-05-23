import { getCards, saveCard as dbSaveCard } from './db';
import type { ArchiveCard } from '../types/Card';

export const loadCards = async (): Promise<ArchiveCard[]> => {
  try {
    console.log('Loading cards from database');
    const cards = await getCards();
    console.log('Successfully loaded cards:', cards.length);
    return cards;
  } catch (error) {
    console.error('Error loading cards:', error);
    return [];
  }
};

export const saveCard = async (card: ArchiveCard): Promise<boolean> => {
  try {
    console.log('Saving card:', card);
    return dbSaveCard(card);
  } catch (error) {
    console.error('Error saving card:', error);
    return false;
  }
};

export const searchCards = (cards: ArchiveCard[], query: string): ArchiveCard[] => {
  if (!query.trim()) return cards;
  
  const searchTerm = query.toLowerCase();
  return cards.filter(card => 
    card.title?.toLowerCase().includes(searchTerm) ||
    card.objectName?.toLowerCase().includes(searchTerm) ||
    card.idNumber?.toLowerCase().includes(searchTerm) ||
    card.briefDescription?.toLowerCase().includes(searchTerm) ||
    card.associatedPeople?.some(person => person.toLowerCase().includes(searchTerm)) ||
    card.associatedPlaces?.some(place => place.toLowerCase().includes(searchTerm))
  );
};
