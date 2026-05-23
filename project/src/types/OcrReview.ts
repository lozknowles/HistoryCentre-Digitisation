import type { ArchiveCard } from './Card';

export interface OcrReviewPage {
  pageNumber: number;
  rawText: string;
}

export interface OcrReviewDocument {
  sourcePdf: string;
  manualReview: boolean;
  pages: OcrReviewPage[];
  fields: Record<string, string>;
}

export interface OcrReviewItem extends OcrReviewDocument {
  draftCard: ArchiveCard;
}
