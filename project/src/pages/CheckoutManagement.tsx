import { useState, useEffect } from 'react';
import { Plus, Save, Search, AlertCircle } from 'lucide-react';
import { loadCards } from '../services/cardService';
import { loadCheckouts, saveCheckout } from '../services/checkoutService';
import type { ArchiveCard } from '../types/Card';
import type { Checkout } from '../types/Checkout';

export function CheckoutManagement() {
  const [cards, setCards] = useState<ArchiveCard[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [selectedCard, setSelectedCard] = useState<ArchiveCard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCheckout, setNewCheckout] = useState<Partial<Checkout>>({
    checkedOutDate: new Date().toISOString().split('T')[0],
    checkedInDate: null
  });

  useEffect(() => {
    Promise.all([loadCards(), loadCheckouts()]).then(([cardsData, checkoutsData]) => {
      setCards(cardsData);
      setCheckouts(checkoutsData);
    });
  }, []);

  const filteredCards = cards.filter(card => 
    card.idNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isItemCheckedOut = (itemId: string) => {
    return checkouts.some(checkout => 
      checkout.itemId === itemId && 
      checkout.checkedInDate === null
    );
  };

  const handleCardSelect = (card: ArchiveCard) => {
    if (isItemCheckedOut(card.idNumber)) {
      alert(`This item (${card.idNumber} - ${card.title}) is currently checked out.`);
      return;
    }
    setSelectedCard(card);
    setNewCheckout(prev => ({
      ...prev,
      itemId: card.idNumber
    }));
  };

  const handleCheckout = async () => {
    if (!selectedCard || !newCheckout.checkedOutBy || !newCheckout.checkedOutDate) {
      alert('Please fill in all required fields');
      return;
    }

    if (isItemCheckedOut(selectedCard.idNumber)) {
      alert(`This item (${selectedCard.idNumber} - ${selectedCard.title}) is currently checked out.`);
      return;
    }

    const checkout: Checkout = {
      id: (checkouts.length + 1).toString(),
      itemId: selectedCard.idNumber,
      checkedOutBy: newCheckout.checkedOutBy,
      checkedOutDate: newCheckout.checkedOutDate,
      checkedInDate: null,
      notes: newCheckout.notes || ''
    };

    const success = await saveCheckout(checkout);
    if (success) {
      setCheckouts([...checkouts, checkout]);
      setNewCheckout({
        checkedOutDate: new Date().toISOString().split('T')[0],
        checkedInDate: null
      });
      setSelectedCard(null);
      setSearchQuery('');
    }
  };

  const handleCheckIn = async (checkout: Checkout) => {
    const updatedCheckout = {
      ...checkout,
      checkedInDate: new Date().toISOString().split('T')[0]
    };

    const success = await saveCheckout(updatedCheckout);
    if (success) {
      setCheckouts(checkouts.map(c => 
        c.id === checkout.id ? updatedCheckout : c
      ));
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Check Out Item</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search Items
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                id="search"
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                placeholder="Search by ID or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {searchQuery && (
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
              {filteredCards.map(card => {
                const isCheckedOut = isItemCheckedOut(card.idNumber);
                return (
                  <button
                    key={card.id}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${
                      isCheckedOut ? 'cursor-not-allowed' : ''
                    }`}
                    onClick={() => handleCardSelect(card)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{card.idNumber} - {card.title}</div>
                        <div className="text-sm text-gray-500">{card.objectName}</div>
                      </div>
                      {isCheckedOut && (
                        <div className="flex items-center text-amber-600">
                          <AlertCircle className="h-5 w-5 mr-1" />
                          <span className="text-sm">Checked Out</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedCard && (
            <div className="border-t pt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Selected Item</label>
                <div className="mt-1 text-sm text-gray-900">
                  {selectedCard.idNumber} - {selectedCard.title}
                </div>
              </div>

              <div>
                <label htmlFor="checkedOutBy" className="block text-sm font-medium text-gray-700">
                  Checked Out By
                </label>
                <input
                  type="text"
                  id="checkedOutBy"
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={newCheckout.checkedOutBy || ''}
                  onChange={(e) => setNewCheckout(prev => ({ ...prev, checkedOutBy: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="checkedOutDate" className="block text-sm font-medium text-gray-700">
                  Check Out Date
                </label>
                <input
                  type="date"
                  id="checkedOutDate"
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={newCheckout.checkedOutDate}
                  onChange={(e) => setNewCheckout(prev => ({ ...prev, checkedOutDate: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={newCheckout.notes || ''}
                  onChange={(e) => setNewCheckout(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleCheckout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Check Out Item
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Current Checkouts</h2>
        </div>
        <div className="divide-y">
          {checkouts
            .filter(checkout => !checkout.checkedInDate)
            .map(checkout => {
              const card = cards.find(c => c.idNumber === checkout.itemId);
              return (
                <div key={checkout.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {card?.title || checkout.itemId}
                    </div>
                    <div className="text-sm text-gray-500">
                      Checked out by {checkout.checkedOutBy} on {checkout.checkedOutDate}
                    </div>
                    {checkout.notes && (
                      <div className="text-sm text-gray-500 mt-1">
                        Note: {checkout.notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleCheckIn(checkout)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    Check In
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Checkout History</h2>
        </div>
        <div className="divide-y">
          {checkouts
            .filter(checkout => checkout.checkedInDate)
            .map(checkout => {
              const card = cards.find(c => c.idNumber === checkout.itemId);
              return (
                <div key={checkout.id} className="px-6 py-4">
                  <div className="font-medium">
                    {card?.title || checkout.itemId}
                  </div>
                  <div className="text-sm text-gray-500">
                    Checked out by {checkout.checkedOutBy} on {checkout.checkedOutDate}
                  </div>
                  <div className="text-sm text-gray-500">
                    Returned on {checkout.checkedInDate}
                  </div>
                  {checkout.notes && (
                    <div className="text-sm text-gray-500 mt-1">
                      Note: {checkout.notes}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
