import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Grid2X2,
  History as HistoryIcon,
  Lightbulb,
  List,
  Loader2,
  MapPin,
  Menu,
  PenLine,
  Plus,
  ScanLine,
  Search,
  X,
} from "lucide-react";
import LegacyApp from "../LegacyApp";
import {
  api,
  Card,
  History,
  Item,
  Loan,
  Scan,
  Spelling,
  Status,
  toCard,
  write,
} from "./model";
import { CardSheet, CardSides } from "./CardSheet";
import { ItemArt } from "./ItemArt";
import { ItemPhoto } from "./PhotoCapture";
import {
  CollectionDetails,
  ManualAccession,
  ScanWorkspace,
} from "./ScanWorkspace";
import "./workspace.css";

type Shared = {
  navigate: (path: string) => void;
  notify: (message: string, error?: boolean) => void;
  reviewer: string;
  refresh: () => void;
};

function Collection({
  items,
  status,
  navigate,
}: {
  items: Item[];
  status: Status;
  navigate: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All items");
  const [page, setPage] = useState(1);
  const [list, setList] = useState(false);
  const [sort, setSort] = useState("highlights");
  let filtered = items.filter(
    (item) =>
      (category === "All items" || item.category === category) &&
      [
        item.title,
        item.archive_reference_canonical,
        item.brief_description,
        item.object_name,
        item.era,
        item.current_location,
        ...item.associated_people,
        ...item.associated_places,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  filtered = [...filtered].sort((a, b) =>
    sort === "title"
      ? a.title.localeCompare(b.title)
      : sort === "newest"
        ? b.record_id - a.record_id
        : sort === "highlights"
          ? ((a.record_id - 1) % 10) - ((b.record_id - 1) % 10) ||
            a.record_id - b.record_id
          : a.archive_reference_canonical.localeCompare(
              b.archive_reference_canonical,
              undefined,
              { numeric: true },
            ),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  return (
    <>
      <div className="collection-hero">
        <div>
          <div className="eyebrow">
            COLLINGHAM & DISTRICT LOCAL HISTORY SOCIETY
          </div>
          <h1>
            Local history.
            <br />
            <em>Carefully kept.</em>
          </h1>
          <p>
            A home for the objects, photographs and everyday stories
            <br className="desktop-break" /> that make a place worth
            remembering.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => navigate("scan")}>
              <ScanLine size={18} /> Scan an archive card
            </button>
            <button
              className="button secondary"
              onClick={() => navigate("new")}
            >
              <Plus size={18} /> Add an item manually
            </button>
          </div>
        </div>
        <div className="hero-card-stack" aria-hidden="true">
          <div className="stack-back" />
          <div className="stack-front">
            <span>COLLINGHAM & DISTRICT</span>
            <h3>
              A record of
              <br />
              things remembered.
            </h3>
            <div className="stack-row">
              <small>SIMPLE OBJECT NAME</small>
              <b>Village life</b>
            </div>
            <div className="stack-row">
              <small>ASSOCIATED PLACES</small>
              <b>Collingham</b>
            </div>
            <span className="stack-stamp">
              ARCHIVE
              <br />
              COLLECTION
            </span>
          </div>
        </div>
      </div>
      <div className="stats-row">
        <button
          onClick={() => {
            setQuery("");
            setCategory("All items");
          }}
        >
          <Archive size={20} />
          <strong>{status.records}</strong>
          <span>Items in the collection</span>
        </button>
        <button onClick={() => navigate("review")}>
          <ScanLine size={20} />
          <strong>{status.pending_scans}</strong>
          <span>Scans awaiting accession</span>
        </button>
        <button onClick={() => navigate("dictionary")}>
          <Lightbulb size={20} />
          <strong>{status.learned_spellings}</strong>
          <span>Remembered spellings</span>
        </button>
        <button onClick={() => navigate("loans")}>
          <ArrowLeftRight size={20} />
          <strong>{status.open_loans}</strong>
          <span>Items on loan</span>
        </button>
      </div>
      <section className="collection-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">EXPLORE THE ARCHIVE</span>
            <h2>
              The collection <small>{filtered.length}</small>
            </h2>
          </div>
          <a className="text-button" href="/api/export">
            <Download size={16} /> Export catalogue
          </a>
        </div>
        <div className="collection-controls">
          <div className="search-box">
            <Search size={19} />
            <input
              aria-label="Search the collection"
              placeholder="Search by title, person, place or reference…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <select
            aria-label="Sort collection"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="highlights">Collection highlights</option>
            <option value="reference">Accession reference</option>
            <option value="newest">Newest additions</option>
            <option value="title">Title A–Z</option>
          </select>
          <div className="segmented icon-segments">
            <button
              className={!list ? "selected" : ""}
              aria-label="Grid view"
              onClick={() => setList(false)}
            >
              <Grid2X2 size={18} />
            </button>
            <button
              className={list ? "selected" : ""}
              aria-label="List view"
              onClick={() => setList(true)}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        <div className="category-filters" aria-label="Filter by item category">
          {["All items", ...status.categories.map((c) => c.name)].map((c) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
            >
              {c}
              {c === "All items" && <span>{items.length}</span>}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Search size={34} />
            <h3>No items match this search.</h3>
            <p>Try another name, place or accession reference.</p>
            <button
              className="button secondary"
              onClick={() => {
                setQuery("");
                setCategory("All items");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className={list ? "item-list" : "item-grid"}>
            {filtered
              .slice(
                (Math.min(page, pages) - 1) * 12,
                Math.min(page, pages) * 12,
              )
              .map((item) => (
                <button
                  className="collection-item"
                  key={item.record_id}
                  onClick={() => navigate("item/" + item.record_id)}
                >
                  <div className="item-image">
                    {item.primary_photo_id ? (
                      <img
                        className="collection-photo"
                        src={`/api/photos/${item.primary_photo_id}/preview`}
                        alt={`Item photograph: ${item.title}`}
                      />
                    ) : (
                      <ItemArt category={item.category} seed={item.record_id} />
                    )}
                    {item.is_sample && (
                      <span className="fictional-tag">FICTIONAL</span>
                    )}
                    {item.active_loan_id && (
                      <span className="loan-tag">On loan</span>
                    )}
                  </div>
                  <div className="item-copy">
                    <span className="item-category">
                      {item.category} <span>·</span> {item.era || "Undated"}
                    </span>
                    <h3>{item.title}</h3>
                    <p className="item-reference">
                      {item.archive_reference_canonical}
                      <ChevronRight size={16} />
                    </p>
                  </div>
                </button>
              ))}
          </div>
        )}
        <div className="pagination">
          <span>
            {filtered.length
              ? `${(Math.min(page, pages) - 1) * 12 + 1}–${Math.min(page * 12, filtered.length)} of ${filtered.length} items`
              : "0 items"}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous collection page"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              Page {Math.min(page, pages)} of {pages}
            </span>
            <button
              className="icon-button"
              aria-label="Next collection page"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function ItemDetail({
  id,
  navigate,
  notify,
  reviewer,
  refresh,
}: Shared & { id: string }) {
  const [item, setItem] = useState<Item | null>(null);
  const [card, setCard] = useState<Card>({});
  const [history, setHistory] = useState<History[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanPages, setScanPages] = useState(0);
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [side, setSide] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loanForm, setLoanForm] = useState(false);
  const [loan, setLoan] = useState({
    borrower: "",
    destination: "",
    due_date: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await api<{
        record: Item;
        history: History[];
        scan_id: string | null;
        scan_pages: number;
        photos: ItemPhoto[];
      }>("/records/" + id);
      setItem(data.record);
      setCard(toCard(data.record));
      setHistory(data.history);
      setScanId(data.scan_id);
      setScanPages(data.scan_pages);
      setPhotos(data.photos);
      setPhotoIndex(0);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }, [id, notify]);
  useEffect(() => {
    load();
    setEditing(false);
    setSide(0);
    setLoanForm(false);
  }, [load]);
  const save = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await write(
        "/records/" + id,
        { ...card, reviewer, revision: item.revision },
        "PATCH",
      );
      setEditing(false);
      await load();
      refresh();
      notify("Card updated. Changes have been added to its history.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const change = (field: string, value: string) =>
    setCard((c) => ({ ...c, [field]: value }));
  const checkout = async () => {
    setBusy(true);
    try {
      await write("/records/" + id + "/loans", { ...loan, reviewer });
      setLoanForm(false);
      await load();
      refresh();
      notify("Loan recorded and current location updated.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const returnItem = async () => {
    setBusy(true);
    try {
      await write("/loans/" + item?.active_loan_id + "/return", { reviewer });
      await load();
      refresh();
      notify("Item returned to its previous location.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  if (!item)
    return (
      <div className="loading-state">
        <Loader2 className="spin" /> Opening archive card…
      </div>
    );
  return (
    <>
      <button className="back-link" onClick={() => navigate("collection")}>
        <ArrowLeft size={16} /> Back to the collection
      </button>
      <div className="page-heading item-heading">
        <div>
          <div className="eyebrow">
            {item.archive_reference_canonical}
            {item.is_sample && (
              <span className="inline-fictional">FICTIONAL TRAINING ITEM</span>
            )}
          </div>
          <h1>{item.title}</h1>
          <p>
            {item.category} <span>·</span> {item.era || "Date not recorded"}{" "}
            <span>·</span>{" "}
            {item.accession_method === "scan"
              ? "Accessioned from a scan"
              : item.accession_method === "manual"
                ? "Accessioned manually"
                : "Catalogue record"}
          </p>
        </div>
        <div className="heading-actions">
          {editing ? (
            <>
              <button
                className="button secondary"
                onClick={() => {
                  setEditing(false);
                  setCard(toCard(item));
                }}
              >
                Cancel edit
              </button>
              <button className="button primary" disabled={busy} onClick={save}>
                <Check size={17} /> Save changes
              </button>
            </>
          ) : (
            <button
              className="button secondary"
              onClick={() => setEditing(true)}
            >
              <PenLine size={17} /> Edit card
            </button>
          )}
        </div>
      </div>
      <div className="detail-layout">
        <div>
          <div className="card-toolbar">
            <span className="verified-label">
              <CheckCircle2 size={16} />{" "}
              {editing ? "Editing archive card" : "Accessioned record"}
            </span>
            <CardSides side={side} onChange={setSide} />
          </div>
          <CardSheet
            value={card}
            onChange={editing ? change : undefined}
            side={side}
            synthetic={item.is_sample}
          />
          {editing && <CollectionDetails card={card} change={change} />}
          <section className="history-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">THE RECORD BEHIND THE RECORD</span>
                <h2>Accession & change history</h2>
              </div>
              <HistoryIcon size={23} />
            </div>
            {history.map((h) => (
              <article className="history-event" key={h.history_id}>
                <span className="history-marker">
                  <Check size={12} />
                </span>
                <div>
                  <b>{h.reason}</b>
                  <p>
                    {h.reviewer_name} <span>·</span> {h.created_at}
                  </p>
                  {h.field_name && (
                    <div className="history-diff">
                      <span>{h.field_name.replace(/_/g, " ")}</span>
                      <del>{h.raw_value || "Blank"}</del>
                      <ArrowRight size={14} />
                      <strong>{h.accepted_value || "Blank"}</strong>
                    </div>
                  )}
                  {h.event_type === "ocr_import" && (
                    <details>
                      <summary>View preserved OCR and accepted text</summary>
                      <pre>
                        {JSON.stringify(
                          {
                            original_ocr: JSON.parse(h.raw_value || "{}"),
                            accepted_card: JSON.parse(h.accepted_value || "{}"),
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </div>
              </article>
            ))}
          </section>
        </div>
        <aside className="detail-aside">
          <div className="object-preview">
            {photos.length ? (
              <>
                <a
                  href={`/api/photos/${photos[photoIndex].photo_id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    className="detail-item-photo"
                    src={`/api/photos/${photos[photoIndex].photo_id}/preview`}
                    alt={`Item photograph: ${item.title}`}
                  />
                </a>
                {photos.length > 1 && (
                  <div className="photo-gallery-tabs">
                    {photos.map((photo, i) => (
                      <button
                        key={photo.photo_id}
                        className={i === photoIndex ? "selected" : ""}
                        onClick={() => setPhotoIndex(i)}
                        aria-label={`View item photo ${i + 1}`}
                      >
                        <img
                          src={`/api/photos/${photo.photo_id}/preview`}
                          alt={`Photo ${i + 1}`}
                        />
                      </button>
                    ))}
                  </div>
                )}
                <a
                  className="text-button photo-download"
                  href={`/api/photos/${photos[photoIndex].photo_id}/original`}
                >
                  <Download size={14} /> Download item photograph
                </a>
              </>
            ) : (
              <ItemArt category={item.category} seed={item.record_id} />
            )}
            <p>
              {photos.length ? "Item photograph" : "Symbolic illustration"}
              {item.is_sample
                ? " · fictional item"
                : photos.length
                  ? " · original retained"
                  : " · item photograph not supplied"}
            </p>
          </div>
          <section className="location-panel">
            <MapPin size={23} />
            <span className="eyebrow">CURRENT LOCATION</span>
            <h3>{item.current_location || "Not recorded"}</h3>
            <p>
              {item.active_loan_id
                ? "This item is currently on loan."
                : "Available in the archive."}
            </p>
            {item.active_loan_id ? (
              <button
                className="button secondary wide"
                disabled={busy}
                onClick={returnItem}
              >
                <ArrowLeftRight size={16} /> Record return
              </button>
            ) : (
              <button
                className="button secondary wide"
                onClick={() => setLoanForm(!loanForm)}
              >
                <ArrowLeftRight size={16} /> Arrange a loan
              </button>
            )}
            {loanForm && (
              <div className="loan-form">
                <label>
                  Borrower
                  <input
                    aria-label="Borrower"
                    value={loan.borrower}
                    onChange={(e) =>
                      setLoan({ ...loan, borrower: e.target.value })
                    }
                  />
                </label>
                <label>
                  Destination
                  <input
                    aria-label="Loan destination"
                    value={loan.destination}
                    onChange={(e) =>
                      setLoan({ ...loan, destination: e.target.value })
                    }
                  />
                </label>
                <label>
                  Return by
                  <input
                    type="date"
                    aria-label="Return by"
                    value={loan.due_date}
                    onChange={(e) =>
                      setLoan({ ...loan, due_date: e.target.value })
                    }
                  />
                </label>
                <label>
                  Loan notes
                  <textarea
                    aria-label="Loan notes"
                    value={loan.notes}
                    onChange={(e) =>
                      setLoan({ ...loan, notes: e.target.value })
                    }
                  />
                </label>
                <button
                  className="button primary wide"
                  disabled={busy}
                  onClick={checkout}
                >
                  Record loan
                </button>
              </div>
            )}
          </section>
          {scanId && (
            <section className="source-record-panel">
              <span className="eyebrow">SOURCE KEPT WITH THIS ITEM</span>
              <h3>The original card</h3>
              <a
                href={`/api/scans/${scanId}/page/${Math.min(side + 1, scanPages)}`}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={`/api/scans/${scanId}/page/${Math.min(side + 1, scanPages)}`}
                  alt="Original uploaded archive card"
                />
              </a>
              <a
                className="text-button"
                href={"/api/scans/" + scanId + "/original"}
              >
                <Download size={15} /> Download original scan
              </a>
            </section>
          )}
          <div className="tip">
            <BookOpen size={21} />
            <p>
              Every correction is recorded with the original value and the
              person who checked it.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function ReviewQueue({
  navigate,
  notify,
}: Pick<Shared, "navigate" | "notify">) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    api<{ scans: Scan[] }>("/scans")
      .then((d) => setScans(d.scans))
      .catch((e) => notify(e.message, true));
  }, [notify]);
  const visible = scans.filter((s) => showAll || s.status !== "accepted");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            A LITTLE HUMAN KNOWLEDGE GOES A LONG WAY
          </div>
          <h1>Review desk</h1>
          <p>
            Pick up a scan, resolve uncertain readings and finish its accession.
          </p>
        </div>
        <button className="button primary" onClick={() => navigate("scan")}>
          <Plus size={17} /> Add a scan
        </button>
      </div>
      <div className="table-toolbar">
        <h2>
          {visible.length} {showAll ? "scans" : "scans to follow up"}
        </h2>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />{" "}
          Include completed accessions
        </label>
      </div>
      {visible.length ? (
        <div className="record-table">
          {visible.map((scan) => (
            <button
              className="table-row scan-row"
              key={scan.scan_id}
              onClick={() =>
                navigate(
                  scan.status === "accepted"
                    ? "item/" + scan.record_id
                    : "scan/" + scan.scan_id,
                )
              }
            >
              <span className="table-icon">
                <FileText size={23} />
              </span>
              <span>
                <b>{scan.filename}</b>
                <small>
                  {scan.status === "review"
                    ? `${scan.pending.length} fields to check · ${scan.suggestions.length} remembered suggestions`
                    : scan.error || `${scan.pages} pages`}
                </small>
              </span>
              <span className={"status-pill " + scan.status}>
                {scan.status === "review"
                  ? "Human review"
                  : scan.status === "accepted"
                    ? "Accessioned"
                    : scan.status === "processing"
                      ? "Scanning"
                      : "Needs another try"}
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <CheckCircle2 size={40} />
          <h2>The review desk is clear.</h2>
          <p>New scans will appear here before they join the collection.</p>
          <button className="button secondary" onClick={() => navigate("scan")}>
            Scan an archive card
          </button>
        </div>
      )}
      <p className="small-note legacy-note">
        Earlier catalogue decisions remain available in the{" "}
        <a href="/review-queue" target="_blank" rel="noreferrer">
          recovered review queue
        </a>
        .
      </p>
    </>
  );
}

function Dictionary({ reviewer, notify, refresh, navigate }: Shared) {
  const [entries, setEntries] = useState<Spelling[]>([]);
  const [query, setQuery] = useState("");
  const load = useCallback(() => {
    api<{ entries: Spelling[] }>("/dictionary")
      .then((d) => setEntries(d.entries))
      .catch((e) => notify(e.message, true));
  }, [notify]);
  useEffect(load, [load]);
  const retire = async (id: number) => {
    try {
      await write("/dictionary/" + id + "/retire", { reviewer });
      load();
      refresh();
      notify("Spelling retired. It will no longer be suggested on new scans.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KNOWLEDGE THAT STAYS WITH THE ARCHIVE</div>
          <h1>Remembered words</h1>
          <p>
            Names and spellings confirmed by people, ready to help with another
            card.
          </p>
        </div>
        <button className="button secondary" onClick={() => navigate("scan")}>
          Try another scan <ScanLine size={16} />
        </button>
      </div>
      <div className="dictionary-explainer">
        <div className="dictionary-symbol">
          <Lightbulb size={30} />
        </div>
        <div>
          <h2>One correction can help the next reading.</h2>
          <p>
            When you choose “Remember this spelling”, the archive saves the
            original OCR variant and the confirmed reading. An exact match on a
            later scan becomes a visible suggestion for you to check.
          </p>
          <span>
            Human-confirmed suggestions · Original OCR retained · No automatic
            accession
          </span>
        </div>
      </div>
      <div className="search-box dictionary-search">
        <Search size={18} />
        <input
          aria-label="Search remembered words"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a name or an OCR spelling…"
        />
      </div>
      {entries.length ? (
        <div className="dictionary-table">
          <div className="dictionary-table-head">
            <span>SCANNER READ</span>
            <span>CONFIRMED READING</span>
            <span>CHECKED BY</span>
            <span>STATUS</span>
          </div>
          {entries
            .filter((e) =>
              (e.variant_text + e.canonical_text)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((entry) => (
              <div className="dictionary-row" key={entry.variant_id}>
                <div className="old-spelling">{entry.variant_text}</div>
                <div>
                  <b>{entry.canonical_text}</b>
                  <small>{entry.entry_type}</small>
                </div>
                <div>{entry.reviewer || "Recovered catalogue evidence"}</div>
                <div>
                  <span
                    className={
                      "status-pill " +
                      (entry.status === "retired" ? "retired" : "accepted")
                    }
                  >
                    {entry.status === "retired" ? "Retired" : "Confirmed"}
                  </span>
                  {entry.status !== "retired" && (
                    <button
                      className="text-button muted"
                      onClick={() => retire(entry.lexicon_entry_id)}
                    >
                      Retire spelling
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={36} />
          <h2>A vocabulary built by you.</h2>
          <p>
            Correct a word during scan review and choose to remember its
            spelling. It will appear here with its source and reviewer.
          </p>
          <button className="button primary" onClick={() => navigate("scan")}>
            Start with a card
          </button>
        </div>
      )}
      <p className="small-note">
        This is a correction dictionary, not model retraining. Ambiguous
        variants are not applied, and accession references are always checked
        individually.
      </p>
    </>
  );
}

function Loans({ navigate, notify, reviewer, refresh }: Shared) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const load = useCallback(() => {
    api<{ loans: Loan[] }>("/loans")
      .then((d) => setLoans(d.loans))
      .catch((e) => notify(e.message, true));
  }, [notify]);
  useEffect(load, [load]);
  const returnItem = async (id: number) => {
    try {
      await write("/loans/" + id + "/return", { reviewer });
      load();
      refresh();
      notify(
        "Return recorded. The item’s previous location has been restored.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KNOW WHERE EVERY ITEM BELONGS</div>
          <h1>Loans & locations</h1>
          <p>Track the journey out, the return date and the safe return.</p>
        </div>
      </div>
      {loans.length ? (
        <div className="record-table">
          {loans.map((loan) => (
            <div className="table-row loan-row" key={loan.loan_id}>
              <span className="table-icon">
                <ArrowLeftRight size={23} />
              </span>
              <button
                className="loan-title"
                onClick={() => navigate("item/" + loan.record_id)}
              >
                <b>{loan.title}</b>
                <small>
                  {loan.archive_reference_canonical} · {loan.borrower}
                </small>
              </button>
              <span>
                <b>{loan.destination}</b>
                <small>Return by {loan.due_date}</small>
              </span>
              {loan.returned_at ? (
                <span className="status-pill accepted">Returned</span>
              ) : (
                <button
                  className="button secondary small"
                  onClick={() => returnItem(loan.loan_id)}
                >
                  Record return
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <MapPin size={38} />
          <h2>Everything is home.</h2>
          <p>
            Open an item’s card to arrange a loan. Its current location will
            follow the loan and return.
          </p>
          <button
            className="button secondary"
            onClick={() => navigate("collection")}
          >
            Find an item
          </button>
        </div>
      )}
    </>
  );
}

export default function ArchiveWorkspace() {
  const [route, setRoute] = useState(
    window.location.hash.slice(2) || "collection",
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [connectionError, setConnectionError] = useState("");
  const [reviewer, setReviewer] = useState(
    localStorage.getItem("collingham-workspace-reviewer") || "",
  );
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [menu, setMenu] = useState(false);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const refresh = useCallback(() => {
    Promise.all([api<Status>("/status"), api<{ records: Item[] }>("/records")])
      .then(([s, r]) => {
        setStatus(s);
        setItems(r.records);
        setConnectionError("");
      })
      .catch((e) => setConnectionError(e.message));
  }, []);
  useEffect(() => {
    refresh();
    const change = () => {
      setRoute(window.location.hash.slice(2) || "collection");
      setMenu(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [refresh]);
  useEffect(() => {
    if (toast && !toast.error) {
      const timeout = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  const navigate = (path: string) => {
    window.location.hash = "/" + path;
  };
  const [section, id] = route.split("/");
  const shared = { navigate, notify, reviewer, refresh };
  if (section === "legacy")
    return (
      <div>
        <div className="legacy-banner">
          <button onClick={() => navigate("collection")}>
            <ArrowLeft size={16} /> Return to the new archive workspace
          </button>
          <span>
            Earlier browser database · stored on this browser and origin
          </span>
        </div>
        <LegacyApp />
      </div>
    );
  return (
    <div className="archive-workspace">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to main content
      </a>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <button className="brand" onClick={() => navigate("collection")}>
          <span className="brand-mark">
            <Archive size={28} strokeWidth={1.4} />
          </span>
          <span>
            History Centre<small>COLLINGHAM & DISTRICT</small>
          </span>
        </button>
        <span className="nav-caption">ARCHIVE WORKSPACE</span>
        <nav>
          {[
            {
              key: "collection",
              label: "The collection",
              icon: Archive,
              badge: null,
            },
            {
              key: "scan",
              label: "Scan & accession",
              icon: ScanLine,
              badge: null,
            },
            {
              key: "review",
              label: "Review desk",
              icon: CheckCircle2,
              badge: status?.pending_scans,
            },
            {
              key: "dictionary",
              label: "Remembered words",
              icon: BookOpen,
              badge: null,
            },
            {
              key: "loans",
              label: "Loans & locations",
              icon: ArrowLeftRight,
              badge: status?.open_loans,
            },
          ].map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              className={
                section === key ||
                (key === "collection" && section === "item") ||
                (key === "scan" && section === "new")
                  ? "active"
                  : ""
              }
              onClick={() => navigate(key)}
            >
              <Icon size={19} strokeWidth={1.6} />
              <span>{label}</span>
              {!!badge && <b>{badge}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>
              Made for the things
              <br />
              we choose to remember.
            </span>
            <div className="small-line" />
          </div>
          <button className="legacy-link" onClick={() => navigate("legacy")}>
            <HistoryIcon size={15} /> Earlier browser records
          </button>
          <a
            className="legacy-link"
            href="/records"
            target="_blank"
            rel="noreferrer"
          >
            <FileText size={15} /> Recovered catalogue
          </a>
          <div className="sidebar-footer">
            <span className="status-dot" /> Local archive workspace
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Archive <ChevronRight size={13} />{" "}
              <b>
                {section === "item"
                  ? "Item record"
                  : section === "scan"
                    ? "Scan & accession"
                    : section === "new"
                      ? "Manual accession"
                      : section === "review"
                        ? "Review desk"
                        : section === "dictionary"
                          ? "Remembered words"
                          : section === "loans"
                            ? "Loans & locations"
                            : "The collection"}
              </b>
            </span>
          </div>
          <div className="topbar-right">
            {status?.synthetic_demo && (
              <span className="demo-pill">
                <span /> FICTIONAL TRAINING COLLECTION
              </span>
            )}
            <label className="reviewer-field">
              <span className="avatar">
                {reviewer
                  ? reviewer
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")
                  : "—"}
              </span>
              <span>
                <small>CHECKED BY</small>
                <input
                  aria-label="Reviewer name"
                  placeholder="Your name"
                  value={reviewer}
                  onChange={(e) => {
                    setReviewer(e.target.value);
                    localStorage.setItem(
                      "collingham-workspace-reviewer",
                      e.target.value,
                    );
                  }}
                />
              </span>
            </label>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {connectionError ? (
            <section className="empty-state">
              <Archive size={40} />
              <h1>Connect the catalogue.</h1>
              <p>{connectionError}</p>
              <p>
                Start the local catalogue server and open its <b>/workspace/</b>{" "}
                page. The earlier browser records remain available in the
                sidebar.
              </p>
              <button className="button primary" onClick={refresh}>
                Try the connection again
              </button>
            </section>
          ) : !status ? (
            <div className="loading-state">
              <Loader2 className="spin" /> Opening the archive…
            </div>
          ) : (
            <>
              {section === "collection" && (
                <Collection items={items} status={status} navigate={navigate} />
              )}
              {section === "scan" && (
                <ScanWorkspace id={id} status={status} {...shared} />
              )}
              {section === "new" && (
                <ManualAccession status={status} {...shared} />
              )}
              {section === "item" && <ItemDetail id={id} {...shared} />}
              {section === "review" && <ReviewQueue {...shared} />}
              {section === "dictionary" && <Dictionary {...shared} />}
              {section === "loans" && <Loans {...shared} />}
              {![
                "collection",
                "scan",
                "new",
                "item",
                "review",
                "dictionary",
                "loans",
              ].includes(section) && (
                <section className="empty-state">
                  <h2>Page not found.</h2>
                  <button
                    className="button primary"
                    onClick={() => navigate("collection")}
                  >
                    Open the collection
                  </button>
                </section>
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>Collingham & District Local History Society</span>
          <span>
            {status?.synthetic_demo
              ? "All collection items, people and provenance in this training database are fictional."
              : "Human knowledge at the heart of every record."}
          </span>
        </footer>
      </div>
      {toast && (
        <div
          className={"toast " + (toast.error ? "toast-error" : "")}
          role={toast.error ? "alert" : "status"}
        >
          <CheckCircle2 size={19} />
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
