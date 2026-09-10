import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  FlaskConical,
  Image,
  Map,
  MapPin,
  Plus,
  Search,
  Shirt,
  X,
} from "lucide-react";

const API = "/cdlhs/api";
const HOME = "/cdlhs/index.html";
type Item = {
  id: string;
  reference: string;
  title: string;
  object: string;
  category: string;
  era: string;
  description: string;
  material: string;
  size: string;
  places: string[];
  people: string[];
  synthetic: boolean;
};
type Day = { date: string; label: string; day: number; month: string };
type Catalogue = {
  items: Item[];
  demo: boolean;
  days: Day[];
  arrival_times: string[];
};
type Receipt = { reference: string; saved: boolean };
type Enquiry = {
  enquiry_id: string;
  kind: string;
  reference: string;
  status: string;
  staff_notes: string;
  revision: number;
  created_at: string;
  payload: Record<string, unknown>;
  photos: { id: string; width: number; height: number }[];
  history: {
    previous_status: string;
    new_status: string;
    notes: string;
    reviewer: string;
    created_at: string;
  }[];
};
type Candidate = { record_id: number; published: boolean; draft: Item };

async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const multipart = data instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    method,
    credentials: "same-origin",
    headers:
      method === "GET"
        ? {}
        : {
            "X-Archive-Request": "public-site",
            ...(multipart ? {} : { "Content-Type": "application/json" }),
          },
    body:
      data === undefined ? undefined : multipart ? data : JSON.stringify(data),
  });
  const result = await response
    .json()
    .catch(() => ({
      error: "The archive could not be reached. Please try again.",
    }));
  if (!response.ok)
    throw new Error(
      result.error || "The request could not be saved. Please try again.",
    );
  return result as T;
}
const values = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries());
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
const link = (view: string) => `${HOME}?view=${view}`;
const entryLink = (id: string) => `${HOME}?item=${encodeURIComponent(id)}`;
function initialSelection(): string[] {
  try {
    const value = JSON.parse(
      sessionStorage.getItem("cdlhs-viewing-list") || "[]",
    );
    return Array.isArray(value)
      ? value.filter((x) => typeof x === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
function ObjectIcon({ category }: { category: string }) {
  const name = category.toLowerCase();
  const Icon = name.includes("photo")
    ? Image
    : name.includes("map")
      ? Map
      : name.includes("book") || name.includes("brochure")
        ? BookOpen
        : name.includes("cloth") || name.includes("textile")
          ? Shirt
          : name.includes("bottle") || name.includes("medical")
            ? FlaskConical
            : name.includes("document") || name.includes("deed")
              ? FileText
              : Archive;
  return <Icon aria-hidden="true" strokeWidth={1.25} />;
}
function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="error-message" role="alert">
      {error}
    </div>
  ) : null;
}
function ContactFields() {
  return (
    <fieldset>
      <legend>Your contact details</legend>
      <div className="form-row">
        <label>
          Your name
          <input name="name" autoComplete="name" maxLength={120} required />
        </label>
        <label>
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
      </div>
      <div className="honey" aria-hidden="true">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="check-label">
        <input type="checkbox" name="consent" required />{" "}
        <span>
          I agree that my details and any photographs may be stored privately
          and used to respond to this request.{" "}
          <a href={link("privacy")} target="_blank" rel="noreferrer">
            How we handle your information
          </a>
          .
        </span>
      </label>
    </fieldset>
  );
}
function ReceiptPanel({
  receipt,
  kind,
  demo,
}: {
  receipt: Receipt;
  kind: string;
  demo: boolean;
}) {
  return (
    <section className="receipt" aria-live="polite">
      <div className="receipt-icon">
        <Check />
      </div>
      <p className="eyebrow">Request received</p>
      <h1>Thank you. We have saved your {kind}.</h1>
      <p>
        Your reference is <strong>{receipt.reference}</strong>. Please keep a
        copy.
      </p>
      {demo ? (
        <p className="notice">
          This is a demonstration. It has created a sample enquiry in the staff
          inbox; it has not booked an appointment with CDLHS or offered a real
          item.
        </p>
      ) : (
        <p>
          A member of the archive team will need to contact you to confirm the
          arrangements. No appointment or transfer of ownership is confirmed by
          this form.
        </p>
      )}
      <p>No automatic email has been sent.</p>
      <a className="primary button" href={HOME}>
        Back to the archive <ArrowRight size={17} />
      </a>
    </section>
  );
}

export default function PublicArchive() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "archive";
  const itemId = params.get("item");
  useEffect(() => {
    api<Catalogue>("/catalogue")
      .then(setCatalogue)
      .catch((e) => setError(message(e)));
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("cdlhs-viewing-list", JSON.stringify(selected));
    } catch {
      /* The list still works for this page. */
    }
  }, [selected]);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < 8
          ? [...current, id]
          : current,
    );
  const selectedItems =
    catalogue?.items.filter((item) => selected.includes(item.id)) || [];
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="society-name" href={HOME}>
          Collingham &amp; District Local History Society
        </a>
        <p>Preserving our past. Sharing our stories.</p>
        <nav aria-label="Archive navigation">
          <a aria-current={view === "archive" ? "page" : undefined} href={HOME}>
            Explore the archive
          </a>
          <a
            aria-current={view === "visit" ? "page" : undefined}
            href={link("visit")}
          >
            Plan a visit{" "}
            {selected.length > 0 && (
              <span className="nav-count">{selected.length}</span>
            )}
          </a>
          <a
            aria-current={view === "offer" ? "page" : undefined}
            href={link("offer")}
          >
            Loan or donate
          </a>
          <a
            className="society-link"
            href="https://collingham-history.org.uk/"
            target="_blank"
            rel="noreferrer"
          >
            Society website ↗
          </a>
        </nav>
        <div className="heritage-banner">
          <img
            src="/cdlhs/cdlhs-banner.jpg"
            width="623"
            height="168"
            alt="Collingham and District Local History Society — a historic village street"
          />
          <div>
            <span className="eyebrow">The History Centre</span>
            <span className="banner-title">
              A village.
              <br />A thousand stories.
            </span>
          </div>
        </div>
      </header>
      {catalogue?.demo && (
        <div className="demo-notice">
          <span className="demo-tag">Demonstration</span>
          <span>
            All 100 archive items are fictional. Please use fictitious details
            when trying the forms. Requests are saved for this demo, not sent to
            CDLHS.
          </span>
        </div>
      )}
      <main id="main" tabIndex={-1}>
        {view === "staff" ? (
          <Staff />
        ) : error ? (
          <>
            <ErrorMessage error={error} />
            <button onClick={() => window.location.reload()}>Try again</button>
          </>
        ) : !catalogue ? (
          <p role="status" className="loading">
            Opening the archive…
          </p>
        ) : view === "visit" ? (
          <Visit
            catalogue={catalogue}
            selected={selectedItems}
            remove={toggle}
            clear={() => setSelected([])}
          />
        ) : view === "offer" ? (
          <Offer catalogue={catalogue} />
        ) : view === "privacy" ? (
          <Privacy demo={catalogue.demo} />
        ) : itemId ? (
          <Entry
            item={catalogue.items.find((i) => i.id === itemId)}
            selected={selected.includes(itemId)}
            toggle={() => toggle(itemId)}
            full={selected.length >= 8}
          />
        ) : (
          <Browse catalogue={catalogue} selected={selected} toggle={toggle} />
        )}
      </main>
      <footer>
        <div>
          <strong>Collingham &amp; District Local History Society</strong>
          <p>
            The History Centre · 11 Swinderby Road
            <br />
            Collingham, Newark, NG23 7PH
          </p>
        </div>
        <div>
          <a href={link("visit")}>Second Saturday · 10am–1pm</a>
          <p>
            <a href={link("privacy")}>Your information</a> ·{" "}
            <a
              href="https://collingham-history.org.uk/history-centre/"
              target="_blank"
              rel="noreferrer"
            >
              About the History Centre ↗
            </a>
          </p>
          <small>
            {catalogue?.demo
              ? "Archive demonstration hosted by Loz Knowles. Not the society’s live catalogue."
              : "Public archive hosted by Loz Knowles."}
          </small>
        </div>
      </footer>
    </div>
  );
}

function Browse({
  catalogue,
  selected,
  toggle,
}: {
  catalogue: Catalogue;
  selected: string[];
  toggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const categories = [
    ...new Set(catalogue.items.map((i) => i.category)),
  ].sort();
  const filtered = useMemo(
    () =>
      catalogue.items.filter(
        (item) =>
          (!category || item.category === category) &&
          `${item.title} ${item.reference} ${item.description} ${item.object} ${item.people.join(" ")} ${item.places.join(" ")}`
            .toLocaleLowerCase("en-GB")
            .includes(query.trim().toLocaleLowerCase("en-GB")),
      ),
    [catalogue, query, category],
  );
  const pages = Math.ceil(filtered.length / 12);
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">Discover the collection</p>
          <h1>
            Small objects.
            <br className="desktop-break" /> Remarkable local stories.
          </h1>
          <p>
            Photographs, letters, everyday objects and memories of Collingham
            and the surrounding villages. Find something that interests you,
            then arrange to see it at the History Centre.
          </p>
        </div>
        <aside className="opening-card">
          <CalendarDays size={23} />
          <strong>Come and explore</strong>
          <p>
            Open on the second Saturday
            <br />
            of each month, 10am–1pm.
          </p>
          {catalogue.days[0] && (
            <span className="next-date">Next: {catalogue.days[0].label}</span>
          )}
          <a href={link("visit")}>
            Plan your visit <ArrowRight size={16} />
          </a>
        </aside>
      </section>
      <section className="search-section" aria-label="Search the collection">
        <label className="search-field">
          <span>Search the archive</span>
          <div>
            <Search size={20} />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Try a name, place, object or reference…"
            />
          </div>
        </label>
        <label>
          Type of item
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </section>
      <div className="results-heading">
        <p aria-live="polite">
          <strong>{filtered.length}</strong>{" "}
          {filtered.length === 1 ? "item" : "items"}
          {query && <> matching “{query}”</>}
          {category && <> · {category}</>}
        </p>
        {selected.length > 0 && (
          <a href={link("visit")}>
            Your viewing list ({selected.length}/8) <ArrowRight size={16} />
          </a>
        )}
      </div>
      {filtered.length === 0 ? (
        <section className="empty-state">
          <Search />
          <h2>No items found</h2>
          <p>Try a shorter name or a different type of item.</p>
          <button
            onClick={() => {
              setQuery("");
              setCategory("");
            }}
          >
            Clear search
          </button>
        </section>
      ) : (
        <div className="collection-grid">
          {filtered.slice((page - 1) * 12, page * 12).map((item) => (
            <article className="collection-card" key={item.id}>
              <a
                className="object-tile"
                href={entryLink(item.id)}
                aria-label={`View ${item.title}`}
              >
                <ObjectIcon category={item.category} />
                <span>{item.category}</span>
                <span className="tile-reference">{item.reference}</span>
              </a>
              <div className="card-copy">
                <div className="item-meta">
                  {item.era || "Date not recorded"}
                  {item.synthetic && <span>Fictional item</span>}
                </div>
                <h2>
                  <a href={entryLink(item.id)}>{item.title}</a>
                </h2>
                <p>{item.description}</p>
                <div className="card-actions">
                  <a href={entryLink(item.id)}>
                    View entry <ArrowRight size={15} />
                  </a>
                  <button
                    className="add-button"
                    aria-label={`${selected.includes(item.id) ? "Remove" : "Add"} ${item.title} ${selected.includes(item.id) ? "from" : "to"} viewing list`}
                    aria-pressed={selected.includes(item.id)}
                    disabled={
                      !selected.includes(item.id) && selected.length >= 8
                    }
                    onClick={() => toggle(item.id)}
                  >
                    {selected.includes(item.id) ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    {selected.includes(item.id) ? "Selected" : "View in person"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="Results pages">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={17} /> Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight size={17} />
          </button>
        </nav>
      )}
      <section className="contribution-strip">
        <BookOpen size={30} />
        <div>
          <h2>Have a piece of local history?</h2>
          <p>
            A photograph, a family document or an everyday object can tell a
            remarkable story.
          </p>
        </div>
        <a className="button" href={link("offer")}>
          Offer an item <ArrowRight size={17} />
        </a>
      </section>
    </>
  );
}

function Entry({
  item,
  selected,
  toggle,
  full,
}: {
  item?: Item;
  selected: boolean;
  toggle: () => void;
  full: boolean;
}) {
  if (!item)
    return (
      <section className="empty-state">
        <h1>This entry is unavailable</h1>
        <p>It may have been withdrawn from the public catalogue.</p>
        <a href={HOME}>Return to the archive</a>
      </section>
    );
  return (
    <>
      <a className="back-link" href={HOME}>
        <ChevronLeft size={16} /> Back to the collection
      </a>
      <div className="entry-layout">
        <div className="entry-art">
          <ObjectIcon category={item.category} />
          <span>{item.category}</span>
          <small>Collection illustration · no item photograph</small>
        </div>
        <section>
          <p className="eyebrow">
            {item.reference}
            {item.synthetic && " · Fictional item"}
          </p>
          <h1>{item.title}</h1>
          <p className="entry-description">{item.description}</p>
          <dl className="record-fields">
            {Object.entries({
              Object: item.object,
              "Date / period": item.era,
              Material: item.material,
              Dimensions: item.size,
              "Associated places": item.places.join(", "),
              "Associated people": item.people.join(", "),
            })
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          <div className="entry-visit">
            <h2>See this item at the History Centre</h2>
            <p>
              Add it to your list and request a visit on a second Saturday.
              Staff will need to confirm availability and access.
            </p>
            <button
              className={selected ? "" : "primary"}
              disabled={!selected && full}
              onClick={toggle}
            >
              {selected ? <Check size={17} /> : <Plus size={17} />}
              {selected
                ? "Remove from viewing list"
                : full
                  ? "Viewing list is full (8 items)"
                  : "Add to viewing list"}
            </button>
            {selected && (
              <a href={link("visit")}>
                Arrange your visit <ArrowRight size={16} />
              </a>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Visit({
  catalogue,
  selected,
  remove,
  clear,
}: {
  catalogue: Catalogue;
  selected: Item[];
  remove: (id: string) => void;
  clear: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = values(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<Receipt>("/visits", "POST", {
        ...data,
        request_key: key,
        consent: data.consent === "on",
        party_size: Number(data.party_size),
        items: selected.map((i) => i.id),
      });
      setReceipt(result);
      clear();
      window.scrollTo(0, 0);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <ReceiptPanel
        receipt={receipt}
        kind="visit request"
        demo={catalogue.demo}
      />
    );
  return (
    <>
      <div className="compact-intro">
        <p className="eyebrow">The History Centre</p>
        <h1>Make time for local history.</h1>
        <p>
          Choose a second Saturday and tell us what you would like to see. Your
          visit is a request until the archive team confirms it.
        </p>
      </div>
      <div className="form-layout">
        <form onSubmit={submit}>
          <fieldset>
            <legend>1. What would you like to see?</legend>
            {selected.length > 0 ? (
              <ul className="viewing-list">
                {selected.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.reference}</small>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => remove(item.id)}
                    >
                      <X size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No items selected yet. <a href={HOME}>Browse the archive</a> or
                describe your research below.
              </p>
            )}
            <label>
              Your research interests{" "}
              {selected.length > 0 && (
                <span className="optional">(optional)</span>
              )}
              <textarea
                name="research"
                rows={3}
                maxLength={2000}
                required={selected.length === 0}
                placeholder="For example, the railway, a family name or the history of your house."
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>2. Choose your visit</legend>
            <div className="form-row">
              <label>
                Second Saturday
                <select name="day" required defaultValue="">
                  <option value="" disabled>
                    Choose a date
                  </option>
                  {catalogue.days.map((day) => (
                    <option key={day.date} value={day.date}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preferred arrival
                <select name="arrival" defaultValue="10:00">
                  {catalogue.arrival_times.map((time) => (
                    <option key={time}>{time}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="short-field">
              Number of visitors
              <input
                name="party_size"
                type="number"
                min={1}
                max={30}
                step={1}
                defaultValue={1}
                required
              />
            </label>
            <label>
              Anything we should know?{" "}
              <span className="optional">(optional)</span>
              <textarea
                name="notes"
                rows={3}
                maxLength={1000}
                placeholder="Access arrangements or anything that would help us prepare. Please avoid sensitive personal information."
              />
            </label>
          </fieldset>
          <ContactFields />
          <ErrorMessage error={error} />
          <button className="primary" disabled={busy}>
            {busy ? "Saving your request…" : "Send visit request"}
            <ArrowRight size={17} />
          </button>
          <p className="form-footnote">
            {catalogue.demo
              ? "This creates a demonstration enquiry, not a real booking."
              : "All visits and item availability need staff confirmation."}{" "}
            Keep the reference shown after sending.
          </p>
        </form>
        <aside className="visit-aside">
          <h2>A warm welcome awaits</h2>
          <div>
            <CalendarDays />
            <p>
              <strong>Second Saturday of the month</strong>
              <br />
              Advance requests help the team prepare.
            </p>
          </div>
          <div>
            <Clock3 />
            <p>
              <strong>10am–1pm</strong>
              <br />
              Free admission. Please allow time to view your items before
              closing.
            </p>
          </div>
          <div>
            <MapPin />
            <p>
              <strong>The History Centre</strong>
              <br />
              11 Swinderby Road
              <br />
              Collingham, Newark
              <br />
              NG23 7PH
            </p>
          </div>
          <a
            href="https://collingham-history.org.uk/history-centre/"
            target="_blank"
            rel="noreferrer"
          >
            Check the society’s visiting information ↗
          </a>
          <p className="muted">
            Published opening dates may change. A preferred arrival time is not
            a reserved slot.
          </p>
        </aside>
      </div>
    </>
  );
}

function PhotoPreview({ file, remove }: { file: File; remove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="photo-preview">
      <img src={url} alt={`Selected photograph: ${file.name}`} />
      <button
        type="button"
        className="icon-button"
        onClick={remove}
        aria-label={`Remove photograph ${file.name}`}
      >
        <X size={17} />
      </button>
      <small>{file.name}</small>
    </div>
  );
}
function Offer({ catalogue }: { catalogue: Catalogue }) {
  const [kind, setKind] = useState("donation");
  const [photos, setPhotos] = useState<File[]>([]);
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  function addPhotos(list: FileList | null) {
    if (!list) return;
    const next = [...photos, ...Array.from(list)];
    if (next.length > 4) {
      setError(
        "Choose up to four photographs. Remove one before adding another.",
      );
      return;
    }
    if (
      next.some(
        (file) =>
          file.size > 5 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setError("Choose JPEG, PNG or WebP photographs, each smaller than 5 MB.");
      return;
    }
    setPhotos(next);
    setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = values(event.currentTarget);
    const form = new FormData();
    form.set(
      "details",
      JSON.stringify({
        ...data,
        kind,
        request_key: key,
        authority: data.authority === "on",
        consent: data.consent === "on",
      }),
    );
    photos.forEach((photo) => form.append("photos", photo));
    setBusy(true);
    setError("");
    try {
      setReceipt(await api<Receipt>("/offers", "POST", form));
      setPhotos([]);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <ReceiptPanel receipt={receipt} kind="item offer" demo={catalogue.demo} />
    );
  return (
    <>
      <div className="compact-intro">
        <p className="eyebrow">Help preserve our shared past</p>
        <h1>Every object has a story.</h1>
        <p>
          Tell us about an item connected with Collingham or the surrounding
          district. Photographs help the archive team understand what you are
          offering.
        </p>
      </div>
      <div className="form-layout">
        <form onSubmit={submit}>
          <fieldset>
            <legend>1. How would you like to offer it?</legend>
            <div className="choice-row">
              {[
                ["donation", "Donate an item", "Offer it as a permanent gift."],
                ["loan", "Loan an item", "Discuss a temporary loan."],
              ].map(([value, title, help]) => (
                <label
                  className={`choice-card ${kind === value ? "chosen" : ""}`}
                  key={value}
                >
                  <input
                    type="radio"
                    name="offer_kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                  />
                  <strong>{title}</strong>
                  <span>{help}</span>
                </label>
              ))}
            </div>
            {kind === "loan" && (
              <label>
                Suggested loan period{" "}
                <span className="optional">(optional)</span>
                <input
                  name="loan_period"
                  maxLength={200}
                  placeholder="For example, six months or by arrangement"
                />
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>2. Tell us about the item</legend>
            <label>
              What is it?
              <input
                name="title"
                required
                maxLength={200}
                placeholder="For example, a family photograph album"
              />
            </label>
            <div className="form-row">
              <label>
                Type of item
                <select name="category" required defaultValue="">
                  <option value="" disabled>
                    Choose a type
                  </option>
                  {[
                    ...new Set([
                      ...catalogue.items.map((i) => i.category),
                      "Other",
                    ]),
                  ]
                    .sort()
                    .map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                </select>
              </label>
              <label>
                Approximate date <span className="optional">(optional)</span>
                <input
                  name="era"
                  maxLength={100}
                  placeholder="For example, about 1930"
                />
              </label>
            </div>
            <label>
              Description and condition
              <textarea
                name="description"
                required
                rows={4}
                maxLength={3000}
                placeholder="What does it show? What is it made of? Include any damage or fragile parts."
              />
            </label>
            <label>
              Connection to Collingham or the district
              <textarea name="connection" required rows={3} maxLength={1500} />
            </label>
            <label>
              What do you know of its history?{" "}
              <span className="optional">(optional)</span>
              <textarea
                name="provenance"
                rows={3}
                maxLength={1500}
                placeholder="How it came to you, who made or used it, or any story that goes with it."
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>
              3. Add photographs <span className="optional">(optional)</span>
            </legend>
            <p className="muted">
              Up to four JPEG, PNG or WebP images, each under 5 MB and 30
              megapixels. Include an overall view and any details or writing.
              Photographs stay private for staff review.
            </p>
            <div className="photo-buttons">
              <label className="button upload-label">
                <Plus size={18} /> Choose photos
                <input
                  aria-label="Choose photographs"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    addPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="button upload-label">
                <Camera size={18} /> Take a photo
                <input
                  aria-label="Take an item photograph"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => {
                    addPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="photo-grid">
              {photos.map((file, index) => (
                <PhotoPreview
                  key={`${file.name}-${file.lastModified}-${index}`}
                  file={file}
                  remove={() =>
                    setPhotos((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                />
              ))}
            </div>
            <p className="form-footnote">
              On a supported phone, “Take a photo” opens the camera before you
              send the offer.
            </p>
          </fieldset>
          <fieldset>
            <legend>4. Permission to offer</legend>
            <label className="check-label">
              <input type="checkbox" name="authority" required />
              <span>
                I own this item or have permission from its owner to offer it.
                This enquiry does not transfer ownership or create a loan
                agreement.
              </span>
            </label>
          </fieldset>
          <ContactFields />
          <ErrorMessage error={error} />
          <button className="primary" disabled={busy}>
            {busy
              ? "Saving your offer…"
              : `Send ${kind === "loan" ? "loan" : "donation"} enquiry`}{" "}
            <ArrowRight size={17} />
          </button>
          <p className="form-footnote">
            Please wait for a reply before bringing or sending any items.
          </p>
        </form>
        <aside className="visit-aside">
          <h2>What might the archive keep?</h2>
          <p>
            Local photographs and albums, deeds and maps, letters and diaries,
            clothing, books, brochures and objects from everyday life.
          </p>
          <h3>The story matters too</h3>
          <p>
            Names, dates, places and how an item was used can be just as
            valuable as the object itself.
          </p>
          <h3>What happens next?</h3>
          <ol>
            <li>Your offer and photographs are saved for review.</li>
            <li>
              Staff discuss its local connection, condition and any arrangements
              with you.
            </li>
            <li>
              Accepted items are recorded through the archive’s accession
              process.
            </li>
          </ol>
          <p className="muted">
            Offers are considered individually. Sending this form does not
            guarantee acceptance.
          </p>
        </aside>
      </div>
    </>
  );
}

function Privacy({ demo }: { demo: boolean }) {
  return (
    <article className="reading-page">
      <p className="eyebrow">Your information</p>
      <h1>What happens to your enquiry?</h1>
      {demo && (
        <p className="notice">
          This is a demonstration run by Loz Knowles. Use fictional names and
          contact details when testing. It is not the society’s live booking or
          donation service.
        </p>
      )}
      <h2>Information you choose to send</h2>
      <p>
        The visit form saves your name, email, preferred date and arrival time,
        number of visitors, selected items, research interests and notes. An
        offer saves your contact details, description, ownership confirmation
        and any photographs you attach.
      </p>
      <h2>Private staff review</h2>
      <p>
        These details and original photographs are stored on the site’s server
        outside the public website folders. Only signed-in archive staff can use
        the enquiry inbox. Original photographs can contain camera or location
        metadata; please remove anything you do not wish to share before
        uploading. The smaller previews remove that metadata.
      </p>
      <p>
        Submitting a form does not publish your information or add your item to
        the catalogue. Staff must review an accession and explicitly approve its
        public description before it can appear in search.
      </p>
      <h2>Arrangements and messages</h2>
      <p>
        A reference confirms that the enquiry was saved. No email is sent
        automatically, and a visit is not confirmed until staff contact you
        separately. Loans and donations require separate agreement.
      </p>
      <h2>Storage on your device</h2>
      <p>
        Your viewing list is kept for this browser session. Staff sign-in uses a
        necessary, secure session cookie. There are no advertising or analytics
        cookies in this archive application.
      </p>
      <h2>Retention and removal</h2>
      <p>
        Enquiries are retained for staff review and follow-up. Quote your
        reference to the person who provided this demonstration if you need
        information corrected or removed. A live public launch needs an agreed
        contact point and retention policy before real enquiries are invited.
      </p>
      <p>
        The society publishes its own{" "}
        <a
          href="https://collingham-history.org.uk/data-privacy-notice/"
          target="_blank"
          rel="noreferrer"
        >
          data privacy notice
        </a>{" "}
        for its activities.
      </p>
    </article>
  );
}

function Staff() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("enquiries");
  useEffect(() => {
    api<{ signed_in: boolean }>("/staff/session")
      .then((r) => setSignedIn(r.signed_in))
      .catch((e) => setError(message(e)));
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ signed_in: boolean }>(
        "/staff/login",
        "POST",
        values(event.currentTarget),
      );
      setSignedIn(result.signed_in);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/staff/logout", "POST", {});
      setSignedIn(false);
    } catch (e) {
      setError(message(e));
    }
  }
  if (!signedIn)
    return (
      <section className="login-panel">
        <p className="eyebrow">Private staff area</p>
        <h1>Archive staff sign-in</h1>
        <p>Review visit requests, item offers and public catalogue entries.</p>
        <ErrorMessage error={error} />
        {signedIn === null ? (
          <p role="status">Checking your session…</p>
        ) : (
          <form onSubmit={login}>
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={300}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </section>
    );
  return (
    <>
      <div className="staff-heading">
        <div>
          <p className="eyebrow">Private staff area</p>
          <h1>Archive desk</h1>
        </div>
        <button onClick={logout}>Sign out</button>
      </div>
      <ErrorMessage error={error} />
      <div className="staff-tabs">
        <button
          aria-pressed={tab === "enquiries"}
          onClick={() => setTab("enquiries")}
        >
          Enquiries
        </button>
        <button
          aria-pressed={tab === "publication"}
          onClick={() => setTab("publication")}
        >
          Public catalogue review
        </button>
      </div>
      {tab === "enquiries" ? <Inbox /> : <Publication />}
    </>
  );
}
function Inbox() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string[]>>({});
  const [active, setActive] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  async function refresh() {
    try {
      const result = await api<{
        enquiries: Enquiry[];
        statuses: Record<string, string[]>;
      }>("/staff/enquiries");
      setRows(result.enquiries);
      setStatuses(result.statuses);
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const item = rows.find((r) => r.enquiry_id === active);
  return (
    <>
      <div className="results-heading">
        <p>Latest {rows.length} enquiries · private to staff</p>
        <button onClick={refresh}>Refresh inbox</button>
      </div>
      <ErrorMessage error={error} />
      <div className="inbox-layout">
        <aside>
          <label>
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All enquiries</option>
              <option value="new">New enquiries</option>
              <option value="visit">Visit requests</option>
              <option value="loan">Loans</option>
              <option value="donation">Donations</option>
            </select>
          </label>
          {loading ? (
            <p role="status">Loading enquiries…</p>
          ) : (
            rows
              .filter(
                (row) =>
                  filter === "all" ||
                  row.kind === filter ||
                  (filter === "new" && row.status === "new"),
              )
              .map((row) => (
                <button
                  className={`inbox-item ${active === row.enquiry_id ? "active" : ""}`}
                  key={row.enquiry_id}
                  onClick={() => setActive(row.enquiry_id)}
                >
                  <span>
                    {row.kind} · {row.status}
                  </span>
                  <strong>
                    {String(row.payload.title || row.payload.name)}
                  </strong>
                  <small>
                    {row.reference} · {row.created_at.slice(0, 10)}
                  </small>
                </button>
              ))
          )}
          {!loading && rows.length === 0 && <p>No enquiries yet.</p>}
        </aside>
        {item ? (
          <EnquiryDetail
            key={`${item.enquiry_id}-${item.revision}`}
            item={item}
            statuses={statuses[item.kind] || []}
            refresh={refresh}
          />
        ) : (
          <section className="empty-state">
            <Archive />
            <h2>Select an enquiry</h2>
            <p>Contact details, photographs and staff notes appear here.</p>
          </section>
        )}
      </div>
    </>
  );
}
function EnquiryDetail({
  item,
  statuses,
  refresh,
}: {
  item: Enquiry;
  statuses: string[];
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = values(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ notice: string }>(
        `/staff/enquiries/${item.enquiry_id}`,
        "PATCH",
        { ...data, revision: item.revision },
      );
      setNotice(result.notice);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="enquiry-detail">
      <p className="eyebrow">
        {item.reference} · {item.kind}
      </p>
      <h2>{String(item.payload.title || item.payload.name)}</h2>
      {item.payload.demo === true && (
        <p className="notice">
          Demonstration enquiry · no real appointment or offer.
        </p>
      )}
      <dl className="record-fields">
        {Object.entries(item.payload)
          .filter(
            ([key]) => !["items", "consent", "authority", "demo"].includes(key),
          )
          .map(
            ([key, value]) =>
              value !== "" && (
                <div key={key}>
                  <dt>{key.replace(/_/g, " ")}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ),
          )}
      </dl>
      {Array.isArray(item.payload.items) && item.payload.items.length > 0 && (
        <>
          <h3>Items to prepare</h3>
          <ul>
            {(
              item.payload.items as {
                id: string;
                title: string;
                reference: string;
              }[]
            ).map((entry) => (
              <li key={entry.id}>
                {entry.title} · {entry.reference}
              </li>
            ))}
          </ul>
        </>
      )}
      {item.photos.length > 0 && (
        <>
          <h3>Private photographs</h3>
          <div className="staff-photos">
            {item.photos.map((photo) => (
              <a
                key={photo.id}
                href={`${API}/staff/enquiries/${item.enquiry_id}/photos/${photo.id}?original=1`}
              >
                <img
                  src={`${API}/staff/enquiries/${item.enquiry_id}/photos/${photo.id}`}
                  alt="Offered item"
                />
                Download original
              </a>
            ))}
          </div>
        </>
      )}
      <form onSubmit={save}>
        <fieldset>
          <legend>Staff follow-up</legend>
          <label>
            Status
            <select name="status" defaultValue={item.status}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Your name
            <input name="reviewer" required maxLength={120} />
          </label>
          <label>
            Private notes
            <textarea
              name="notes"
              maxLength={3000}
              rows={4}
              defaultValue={item.staff_notes}
            />
          </label>
          <p className="notice">
            Changing status does not send an email. Contact the enquirer
            separately before recording an agreed visit or transfer.
          </p>
          <ErrorMessage error={error} />
          {notice && <p role="status">{notice}</p>}
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save staff update"}
          </button>
        </fieldset>
      </form>
      {item.history.length > 0 && (
        <details>
          <summary>Review history ({item.history.length})</summary>
          {item.history.map((entry, index) => (
            <p key={index}>
              <strong>{entry.reviewer}</strong> · {entry.previous_status} →{" "}
              {entry.new_status}
              <br />
              <small>{entry.created_at}</small>
              <br />
              {entry.notes}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
function Publication() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  async function refresh() {
    try {
      const result = await api<{ candidates: Candidate[] }>(
        "/staff/publication",
      );
      setRows(result.candidates);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const row = rows.find((r) => r.record_id === active);
  return (
    <>
      <p className="notice">
        Only explicitly approved public fields appear in search. Review names
        and descriptions before publishing. Donor details, storage locations and
        original uploads are excluded.
      </p>
      <ErrorMessage error={error} />
      <div className="inbox-layout">
        <aside>
          <label>
            Find a catalogue record
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {rows
            .filter((r) =>
              `${r.draft.title} ${r.draft.reference}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((candidate) => (
              <button
                key={candidate.record_id}
                className={`inbox-item ${active === candidate.record_id ? "active" : ""}`}
                onClick={() => setActive(candidate.record_id)}
              >
                <span>{candidate.published ? "Public" : "Private"}</span>
                <strong>{candidate.draft.title}</strong>
                <small>{candidate.draft.reference}</small>
              </button>
            ))}
        </aside>
        {row ? (
          <PublishEntry
            key={`${row.record_id}-${row.published}`}
            row={row}
            refresh={refresh}
          />
        ) : (
          <section className="empty-state">
            <h2>Choose a record to review</h2>
            <p>Publication is a separate decision from accession.</p>
          </section>
        )}
      </div>
    </>
  );
}
function PublishEntry({
  row,
  refresh,
}: {
  row: Candidate;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewer, setReviewer] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = values(event.currentTarget);
    const item = { ...row.draft };
    (
      [
        "title",
        "object",
        "category",
        "era",
        "description",
        "material",
        "size",
      ] as const
    ).forEach((key) => {
      item[key] = String(data[key] || "");
    });
    item.people = String(data.people || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    item.places = String(data.places || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    setBusy(true);
    setError("");
    try {
      await api(`/staff/publication/${row.record_id}`, "PUT", {
        item,
        reviewer,
        approved: data.approved === "on",
      });
      setNotice("The approved entry is now public.");
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    if (!reviewer.trim()) {
      setError("Enter your name before withdrawing this entry.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/staff/publication/${row.record_id}`, "DELETE", { reviewer });
      setNotice("The entry has been withdrawn from public search.");
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="enquiry-detail">
      <p className="eyebrow">
        {row.draft.reference} · {row.published ? "Public" : "Private"}
        {row.draft.synthetic && " · Fictional"}
      </p>
      <h2>Review the public entry</h2>
      <form onSubmit={save}>
        {(
          [
            "title",
            "object",
            "category",
            "era",
            "description",
            "material",
            "size",
          ] as const
        ).map((key) => (
          <label key={key} className="capital-label">
            {key}
            {key === "description" ? (
              <textarea
                name={key}
                defaultValue={row.draft[key]}
                maxLength={4000}
                rows={4}
                required
              />
            ) : (
              <input
                name={key}
                defaultValue={row.draft[key]}
                maxLength={4000}
                required={key === "title"}
              />
            )}
          </label>
        ))}
        <label>
          People{" "}
          <span className="optional">(one per line; review for privacy)</span>
          <textarea
            name="people"
            defaultValue={row.draft.people.join("\n")}
            rows={3}
          />
        </label>
        <label>
          Places <span className="optional">(one per line)</span>
          <textarea
            name="places"
            defaultValue={row.draft.places.join("\n")}
            rows={3}
          />
        </label>
        <label>
          Your name
          <input
            required
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            maxLength={120}
          />
        </label>
        <label className="check-label">
          <input name="approved" type="checkbox" required />
          <span>
            I have checked these fields and approve them for public display.
          </span>
        </label>
        <ErrorMessage error={error} />
        {notice && <p role="status">{notice}</p>}
        <div className="photo-buttons">
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Publish approved entry"}
          </button>
          {row.published && (
            <button type="button" disabled={busy} onClick={withdraw}>
              Withdraw from public search
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
