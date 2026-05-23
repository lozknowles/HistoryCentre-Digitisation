import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loadCards } from '../services/cardService';
import { CardPreview } from '../components/CardPreview';
import type { ArchiveCard } from '../types/Card';

type SortField = keyof ArchiveCard;
type SortDirection = 'asc' | 'desc';

export function Search() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<ArchiveCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<ArchiveCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('idNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [hoveredCard, setHoveredCard] = useState<ArchiveCard | null>(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    console.log('Loading cards...');
    loadCards().then(cards => {
      console.log('Cards loaded:', cards.length);
      setCards(cards);
    });
  }, []);

  useEffect(() => {
    let results = [...cards];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(card => 
        card.title.toLowerCase().includes(query) ||
        card.objectName.toLowerCase().includes(query) ||
        card.idNumber.toLowerCase().includes(query) ||
        card.briefDescription.toLowerCase().includes(query) ||
        card.associatedPeople.some(person => person.toLowerCase().includes(query)) ||
        card.associatedPlaces.some(place => place.toLowerCase().includes(query))
      );
    }

    results.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (Array.isArray(aValue) && Array.isArray(bValue)) {
        const aStr = aValue.join(', ');
        const bStr = bValue.join(', ');
        return sortDirection === 'asc' ? 
          aStr.localeCompare(bStr) : 
          bStr.localeCompare(aStr);
      }
      
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortDirection === 'asc' ? 
        aStr.localeCompare(bStr) : 
        bStr.localeCompare(aStr);
    });

    console.log('Filtered cards:', results.length);
    setFilteredCards(results);
  }, [cards, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleMouseEnter = (card: ArchiveCard, event: React.MouseEvent) => {
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    
    // Calculate position to ensure preview stays in viewport
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const previewHeight = 300; // Approximate preview height
    const previewWidth = 384; // w-96 = 24rem = 384px
    const offset = 16; // Spacing between row and preview
    
    // Position preview to the right by default
    let left = rect.right + offset;
    let top = rect.top + window.scrollY;

    // If preview would go off right edge, position to the left
    if (left + previewWidth > viewportWidth) {
      left = Math.max(0, rect.left - previewWidth - offset);
    }

    // Adjust vertical position to keep preview in viewport
    if (top + previewHeight > viewportHeight + window.scrollY) {
      top = Math.max(
        window.scrollY,
        window.scrollY + viewportHeight - previewHeight - offset
      );
    }

    // Ensure minimum offset from top of viewport
    top = Math.max(window.scrollY + offset, top);

    const position = { x: left, y: top };
    console.log('Mouse enter:', {
      cardId: card.id,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      },
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      },
      position,
      scroll: {
        x: window.scrollX,
        y: window.scrollY
      }
    });

    setPreviewPosition(position);
    setHoveredCard(card);
  };

  const handleMouseLeave = () => {
    console.log('Mouse leave');
    setHoveredCard(null);
  };

  const handleCardClick = (cardIndex: number) => {
    navigate(`/cards`, { state: { selectedCardIndex: cardIndex } });
  };

  const SortButton = ({ field, label }: { field: SortField, label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium ${
        sortField === field ? 'text-blue-600' : 'text-gray-500'
      }`}
      title={`Sort by ${label}`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div className="relative">
      <div className="mb-6">
        <div className="relative">
          <label htmlFor="search-input" className="sr-only">
            Search cards
          </label>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            id="search-input"
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-gray-50 border-b">
          <SortButton field="idNumber" label="ID" />
          <SortButton field="objectName" label="Object" />
          <SortButton field="title" label="Title" />
          <SortButton field="dateReceived" label="Date Received" />
          <SortButton field="currentLocation" label="Location" />
        </div>

        <div className="divide-y divide-gray-200">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className="relative group hover:bg-gray-50 transition-colors duration-150"
              onMouseEnter={(e) => handleMouseEnter(card, e)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleCardClick(cards.findIndex(c => c.id === card.id))}
                className="w-full text-left grid grid-cols-5 gap-4 px-4 py-3"
                aria-label={`View details for ${card.title}`}
              >
                <div className="text-sm font-medium text-gray-900">{card.idNumber}</div>
                <div className="text-sm text-gray-500">{card.objectName}</div>
                <div className="text-sm text-gray-900">{card.title}</div>
                <div className="text-sm text-gray-500">{card.dateReceived}</div>
                <div className="text-sm text-gray-500">{card.currentLocation}</div>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500 text-right" aria-live="polite">
        {filteredCards.length} results found
      </div>

      {hoveredCard && (
        <div 
          className="fixed shadow-2xl bg-white rounded-lg overflow-hidden pointer-events-none"
          style={{
            top: `${previewPosition.y}px`,
            left: `${previewPosition.x}px`,
            zIndex: 9999,
            maxWidth: '384px',
            width: '100%'
          }}
          role="tooltip"
          aria-label={`Preview of ${hoveredCard.title}`}
        >
          <CardPreview card={hoveredCard} />
        </div>
      )}
    </div>
  );
}