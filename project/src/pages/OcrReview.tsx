import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, RotateCcw, Save } from 'lucide-react';
import { CardForm } from '../components/CardForm';
import { loadCards, saveCard } from '../services/cardService';
import { loadOcrReviewQueue, markOcrReviewed } from '../services/ocrReviewService';
import type { ArchiveCard } from '../types/Card';
import type { OcrReviewItem } from '../types/OcrReview';

export function OcrReview() {
  const [items, setItems] = useState<OcrReviewItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCard, setSelectedCard] = useState<ArchiveCard | null>(null);
  const [savedCards, setSavedCards] = useState<ArchiveCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    Promise.all([loadOcrReviewQueue(), loadCards()])
      .then(([queue, cards]) => {
        setItems(queue);
        setSavedCards(cards);
        setSelectedCard(queue[0]?.draftCard || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentItem = items[selectedIndex] || null;

  useEffect(() => {
    setSelectedCard(currentItem?.draftCard || null);
  }, [currentItem]);

  const cardExists = useMemo(() => {
    if (!selectedCard) return false;
    return savedCards.some(card => card.idNumber && card.idNumber === selectedCard.idNumber);
  }, [savedCards, selectedCard]);

  const handlePrevious = () => {
    setSelectedIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
  };

  const handleChange = (field: keyof ArchiveCard, value: any) => {
    setSelectedCard(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleApprove = async () => {
    if (!currentItem || !selectedCard) return;
    const success = await saveCard(selectedCard);
    if (success) {
      markOcrReviewed(currentItem.sourcePdf);
      setSavedCards(prev => {
        const next = prev.filter(card => card.id !== selectedCard.id);
        return [...next, selectedCard];
      });
      setMessage(`Saved ${currentItem.sourcePdf} to the archive database.`);
      setItems(prev => prev.filter(item => item.sourcePdf !== currentItem.sourcePdf));
      setSelectedIndex(0);
    } else {
      setMessage('Save failed.');
    }
  };

  const handleSkip = () => {
    if (!currentItem) return;
    markOcrReviewed(currentItem.sourcePdf);
    setItems(prev => prev.filter(item => item.sourcePdf !== currentItem.sourcePdf));
    setSelectedIndex(0);
    setMessage(`Skipped ${currentItem.sourcePdf}.`);
  };

  const handleReset = () => {
    if (!currentItem) return;
    setSelectedCard(currentItem.draftCard);
    setMessage('Draft reset to OCR values.');
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-500">
        Loading OCR review queue...
      </div>
    );
  }

  if (!items.length || !currentItem || !selectedCard) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <Check className="mx-auto mb-3 h-8 w-8 text-green-600" />
        <h2 className="text-lg font-semibold text-gray-900">No OCR items waiting</h2>
        <p className="mt-2 text-sm text-gray-500">Everything in the review queue has been handled for now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">OCR Review</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review extracted text before it becomes a live archive record.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {selectedIndex + 1} of {items.length}
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">{currentItem.sourcePdf}</div>
              <div className="text-xs text-gray-500">Manual review required</div>
            </div>
            {cardExists && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                <Check className="h-3 w-3" />
                Already saved
              </span>
            )}
          </div>

          <div className="space-y-3">
            {currentItem.pages.map(page => (
              <div key={page.pageNumber} className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
                  <FileText className="h-4 w-4" />
                  Page {page.pageNumber}
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-gray-700">
                  {page.rawText}
                </pre>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={selectedIndex === 0}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </button>
            <button
              onClick={handleNext}
              disabled={selectedIndex === items.length - 1}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </button>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mr-2 inline-block h-4 w-4 align-text-bottom" />
            OCR is draft-only here. Please correct fields before approving the record.
          </div>

          <CardForm data={selectedCard} onChange={handleChange} />

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset draft
            </button>
            <button
              onClick={handleSkip}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Skip
            </button>
            <button
              onClick={handleApprove}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Save className="mr-2 h-4 w-4" />
              Save to archive
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
