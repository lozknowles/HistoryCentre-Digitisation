import { useEffect, useRef } from 'react';
import type { ArchiveCard } from '../types/Card';

interface CardPreviewProps {
  card: ArchiveCard;
}

export function CardPreview({ card }: CardPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      console.log('Preview card dimensions:', {
        cardId: card.id,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        element: previewRef.current
      });
    }
  }, [card.id]);
  
  return (
    <div 
      ref={previewRef}
      className="rounded-lg shadow-xl p-6 border border-gray-200 w-96 pointer-events-none"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
          <p className="text-sm text-gray-500">
            <span className="font-medium">ID:</span> {card.idNumber} - {card.objectName}
          </p>
        </div>
        
        <div className="text-sm">
          <p className="text-gray-600">{card.briefDescription}</p>
        </div>

        {(card.associatedPeople.length > 0 || card.associatedPlaces.length > 0) && (
          <div className="space-y-2">
            {card.associatedPeople.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500">Associated People</h4>
                <p className="text-sm">{card.associatedPeople.join(', ')}</p>
              </div>
            )}
            {card.associatedPlaces.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500">Associated Places</h4>
                <p className="text-sm">{card.associatedPlaces.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="text-xs font-medium text-gray-500">Current Location</h4>
            <p>{card.currentLocation}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-500">Condition</h4>
            <p>{card.condition}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
