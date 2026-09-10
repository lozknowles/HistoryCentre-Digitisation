import type { ArchiveCard } from '../types/Card';

interface SearchDropdownProps {
  searchResults: ArchiveCard[];
  onSelect: (card: ArchiveCard) => void;
  onClose: () => void;
}

export function SearchDropdown({ searchResults, onSelect, onClose }: SearchDropdownProps) {
  return (
    <div 
      className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm"
      onBlur={onClose}
    >
      {searchResults.length === 0 ? (
        <div className="px-4 py-2 text-sm text-gray-500">
          No results found
        </div>
      ) : (
        searchResults.map((card) => (
          <div
            key={card.id}
            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
            onClick={() => onSelect(card)}
          >
            <div className="flex items-center">
              <span className="font-normal truncate">
                {card.title || card.objectName || 'Untitled Card'}
              </span>
              <span className="ml-2 text-sm text-gray-500">
                ({card.idNumber})
              </span>
            </div>
            <div className="text-sm text-gray-500 truncate">
              {card.briefDescription}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
