export const fields = [
  ["object_name", "Simple object name", 8],
  ["archive_reference_canonical", "ID number", 4],
  ["title", "Title", 8],
  ["date_received", "Date received", 4],
  ["brief_description", "Brief description", 12],
  ["donated_by", "Donated / loaned by", 8],
  ["donation_date", "Date", 4],
  ["copyright", "Copyright", 12],
  ["associated_people", "Associated people", 12],
  ["associated_places", "Associated places", 12],
  ["home_location", "Home location", 4],
  ["home_location_date", "Date", 2],
  ["current_location", "Current location", 4],
  ["current_location_date", "Date", 2],
  [
    "physical_description",
    "Physical description, family, street, house etc.",
    12,
  ],
  ["size", "Size", 6],
  ["condition", "Condition", 6],
  ["notes", "Notes, cross references etc.", 12],
  ["cross_references", "Cross references", 12],
] as const;
export const labels = Object.fromEntries(
  fields.map(([key, label]) => [key, label]),
);
export const categories = [
  "Photographs",
  "Clothing & textiles",
  "Books & albums",
  "Helmets & uniform",
  "Bottles & medicine",
  "Deeds & documents",
  "Maps & plans",
  "Brochures & ephemera",
  "Domestic objects",
  "Tools & trade",
  "Uncategorised",
];
export type Card = Record<string, string>;
export interface Item {
  record_id: number;
  title: string;
  object_name: string;
  archive_reference_canonical: string;
  category: string;
  era: string;
  material: string;
  is_sample: boolean;
  primary_photo_id: string | null;
  photo_count: number;
  current_location: string;
  brief_description: string;
  revision: number;
  accession_method: string;
  active_loan_id: number | null;
  associated_people: string[];
  associated_places: string[];
  [key: string]: unknown;
}
export interface Status {
  workspace_id: string;
  records: number;
  pending_scans: number;
  learned_spellings: number;
  open_loans: number;
  synthetic_demo: boolean;
  categories: { name: string; count: number }[];
  ocr: { tesseract: boolean; pdf: boolean };
}
export interface Measure {
  word_accuracy: number;
  word_errors: number;
  reference_words: number;
}
export interface Scan {
  scan_id: string;
  status: "processing" | "review" | "accepted" | "failed";
  filename: string;
  profile: string;
  raw_fields: Card;
  draft_fields: Card;
  flagged: string[];
  pending: string[];
  reviewed: string[];
  pages: number;
  elapsed_seconds: number;
  error: string | null;
  record_id: number | null;
  words: {
    text: string;
    confidence: number;
    field: string;
    page: number;
    left: number;
    top: number;
    width: number;
    height: number;
  }[];
  suggestions: {
    field: string;
    raw: string;
    suggested: string;
    source: string;
  }[];
  benchmark: {
    scope: string;
    fixture: string;
    raw: Measure;
    draft: Measure;
  } | null;
}
export interface Spelling {
  variant_id: number;
  lexicon_entry_id: number;
  variant_text: string;
  canonical_text: string;
  status: string;
  entry_type: string;
  reviewer: string;
  source_reference: string;
}
export interface Loan {
  loan_id: number;
  record_id: number;
  title: string;
  archive_reference_canonical: string;
  borrower: string;
  destination: string;
  due_date: string;
  returned_at: string | null;
}
export interface History {
  history_id: number;
  event_type: string;
  field_name: string | null;
  raw_value: string | null;
  accepted_value: string | null;
  reviewer_name: string;
  reason: string;
  created_at: string;
}

export function toCard(item: Record<string, unknown>): Card {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.join("; ")
        : value == null
          ? ""
          : String(value),
    ]),
  );
}
export function blankCard(demo = false): Card {
  return {
    ...Object.fromEntries(fields.map(([key]) => [key, ""])),
    category: "Uncategorised",
    era: "",
    material: "",
    date_received: new Date().toISOString().slice(0, 10),
    archive_reference_canonical: demo ? "DEMO/2026/" : "",
    provenance_note: demo ? "Fictional training item. No real accession." : "",
  };
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    headers: {
      "X-Archive-Request": "workspace",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({
    error: "The catalogue server did not return a readable response.",
  }));
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data as T;
}
export const write = <T>(path: string, data: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(data) });
