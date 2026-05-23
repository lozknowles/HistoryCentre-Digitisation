import React from 'react';
import { Search } from 'lucide-react';
import type { ArchiveCard } from '../types/Card';

interface CardListProps {
  cards: ArchiveCard[];
  onSelect: (card: ArchiveCard) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function CardList({ cards, onSelect, searchQuery, onSearchChange }: CardListProps) {
  const filteredCards = cards.filter(card => 
    Object.values(card).some(value => 
      value && value.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search cards..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCards.map((card) => (
          <div
            key={card.id}
            onClick={() => onSelect(card)}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {card.title || 'Untitled Card'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">ID: {card.idNumber}</p>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {card.briefDescription || 'No description available'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {card.associatedPeople.slice(0, 3).map((person, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {person}
                  </span>
                ))}
                {card.associatedPeople.length > 3 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    +{card.associatedPeople.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}