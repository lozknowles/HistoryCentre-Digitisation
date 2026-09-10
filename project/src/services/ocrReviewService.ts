import type { ArchiveCard } from '../types/Card';
import type { OcrReviewDocument, OcrReviewItem } from '../types/OcrReview';

const REVIEWED_KEY = 'ocrReviewedDocs';

const getReviewedKeys = (): Set<string> => {
  try {
    const raw = localStorage.getItem(REVIEWED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const setReviewedKey = (sourcePdf: string) => {
  const reviewed = getReviewedKeys();
  reviewed.add(sourcePdf);
  localStorage.setItem(REVIEWED_KEY, JSON.stringify(Array.from(reviewed)));
};

const toDate = (value: string) => {
  if (!value.trim()) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
};

const splitList = (value: string) => {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
};

export const loadOcrReviewQueue = async (): Promise<OcrReviewItem[]> => {
  const response = await fetch(`${import.meta.env.BASE_URL}data/ocr-review.json`);
  if (!response.ok) {
    throw new Error(`Failed to load OCR review queue: ${response.status}`);
  }

  const docs: OcrReviewDocument[] = await response.json();
  const reviewed = getReviewedKeys();

  return docs
    .filter(doc => !reviewed.has(doc.sourcePdf))
    .map((doc, index) => ({
      ...doc,
      draftCard: toDraftCard(doc, index),
    }));
};

export const markOcrReviewed = (sourcePdf: string) => {
  setReviewedKey(sourcePdf);
};

export const toDraftCard = (doc: OcrReviewDocument, index = 0): ArchiveCard => ({
  id: `${doc.sourcePdf}-${index + 1}`,
  objectName: doc.fields['Simple object name'] || 'Document',
  idNumber: doc.fields['ID number'] || '',
  title: doc.fields['Title'] || doc.sourcePdf.replace(/\.pdf$/i, ''),
  dateReceived: toDate(doc.fields['Date received'] || ''),
  briefDescription: doc.fields['Brief description'] || '',
  donatedBy: doc.fields['Donated/loan by'] || '',
  donationDate: toDate(doc.fields['Date (Donation/loan)'] || ''),
  copyright: doc.fields['Copyright'] || '',
  associatedPeople: splitList(doc.fields['Associated people'] || ''),
  associatedPlaces: splitList(doc.fields['Associated places'] || ''),
  homeLocation: doc.fields['Home location'] || '',
  homeLocationDate: toDate(doc.fields['Date (Home location)'] || ''),
  currentLocation: doc.fields['Current location'] || '',
  currentLocationDate: toDate(doc.fields['Date (Current location)'] || ''),
  physicalDescription: doc.fields['Physical description'] || '',
  size: doc.fields['Size'] || '',
  condition: doc.fields['Condition'] || '',
  notes: doc.fields['Notes'] || '',
  crossReferences: ''
});
