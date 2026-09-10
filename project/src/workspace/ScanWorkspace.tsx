import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  ScanLine,
  Upload,
  ZoomIn,
} from "lucide-react";
import {
  api,
  blankCard,
  Card,
  categories,
  fields,
  labels,
  Scan,
  Status,
  write,
} from "./model";
import { CardSheet, CardSides } from "./CardSheet";
import { PhotoCapture, usePhotoDraft } from "./PhotoCapture";

type Props = {
  id?: string;
  status: Status;
  reviewer: string;
  notify: (message: string, error?: boolean) => void;
  refresh: () => void;
  navigate: (path: string) => void;
};
const firstPending = (scan: Scan) =>
  ["donated_by", "associated_people", ...scan.pending].find((f) =>
    scan.pending.includes(f),
  ) || "";

export function Accuracy({ scan }: { scan: Scan }) {
  const b = scan.benchmark;
  if (!b)
    return (
      <div className="accuracy-panel">
        <div className="eyebrow">HUMAN VERIFICATION</div>
        <h3>Confidence is a prompt to check.</h3>
        <p>
          This scan has no verified reference transcript, so its true accuracy
          is unknown. Check every field against the source.
        </p>
      </div>
    );
  return (
    <div className="accuracy-panel">
      <div className="eyebrow">MEASURED ON THIS FICTIONAL CARD</div>
      <div className="accuracy-numbers">
        <div>
          <strong>
            {b.raw.word_accuracy.toFixed(2)}
            <small>%</small>
          </strong>
          <span>Original OCR</span>
        </div>
        <ArrowRight size={22} />
        <div className="improved">
          <strong>
            {b.draft.word_accuracy.toFixed(2)}
            <small>%</small>
          </strong>
          <span>
            {scan.status === "accepted" ? "Verified card" : "Current draft"}
          </span>
        </div>
      </div>
      <div className="accuracy-track">
        <span style={{ width: b.draft.word_accuracy + "%" }} />
      </div>
      <p>
        {b.draft.word_errors} word errors / {b.draft.reference_words} reference
        words. Case and punctuation ignored. Measured against this synthetic
        card’s known text; results on real handwriting will vary.
      </p>
    </div>
  );
}

export function CollectionDetails({
  card,
  change,
}: {
  card: Card;
  change: (field: string, value: string) => void;
}) {
  return (
    <div className="collection-details">
      <label>
        Item category
        <select
          aria-label="Item category"
          value={card.category || "Uncategorised"}
          onChange={(e) => change("category", e.target.value)}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Item date / era
        <input
          aria-label="Item date or era"
          value={card.era || ""}
          onChange={(e) => change("era", e.target.value)}
          placeholder="e.g. circa 1920"
        />
      </label>
      <label>
        Material
        <input
          aria-label="Material"
          value={card.material || ""}
          onChange={(e) => change("material", e.target.value)}
          placeholder="e.g. glass, paper, wool"
        />
      </label>
    </div>
  );
}

export function ScanWorkspace({
  id,
  status,
  reviewer,
  notify,
  refresh,
  navigate,
}: Props) {
  const [scan, setScan] = useState<Scan | null>(null);
  const photoKey = `archive-photos:${status.workspace_id}:scan:${id || "new"}`;
  const [photos, setPhotos] = usePhotoDraft(photoKey);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [card, setCard] = useState<Card>(blankCard(status.synthetic_demo));
  const [active, setActive] = useState("");
  const [side, setSide] = useState(0);
  const [sourceSide, setSourceSide] = useState(0);
  const [remember, setRemember] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState("card");
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!id) {
      setScan(null);
      setFile(null);
      setVerified(false);
      setSide(0);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const job = await api<Scan>("/scans/" + id);
        if (stopped) return;
        setScan(job);
        if (job.status === "processing") timer = setTimeout(poll, 1000);
        else {
          setCard({ ...blankCard(status.synthetic_demo), ...job.draft_fields });
          setActive(firstPending(job));
          refresh();
        }
      } catch (e) {
        if (!stopped) notify((e as Error).message, true);
      }
    };
    setVerified(false);
    setRemember(false);
    setSide(0);
    setSourceSide(0);
    setSeconds(0);
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]); // A scan's edits remain local until explicitly reviewed or accessioned.
  useEffect(() => {
    if (scan?.status !== "processing") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [scan?.status]);

  const change = (field: string, value: string) => {
    setCard((c) => ({ ...c, [field]: value }));
    setVerified(false);
  };
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("profile", profile);
      const job = await api<{ scan_id: string }>("/scans", {
        method: "POST",
        body: data,
      });
      navigate("scan/" + job.scan_id);
      refresh();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    if (!scan || !active) return;
    setBusy(true);
    try {
      const next = await write<Scan>("/scans/" + scan.scan_id + "/review", {
        field: active,
        value: card[active] || "",
        remember,
        reviewer,
      });
      setScan(next);
      setActive(firstPending(next));
      setRemember(false);
      setVerified(false);
      refresh();
      notify(
        remember && scan.raw_fields[active] !== card[active]
          ? "Correction saved. This spelling can help with later scans."
          : "Field checked and saved.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const accession = async () => {
    if (!scan) return;
    setBusy(true);
    try {
      const result = await write<{ record_id: number }>("/records", {
        ...card,
        scan_id: scan.scan_id,
        reviewer,
        human_verified: verified,
        photo_ids: photos.map((p) => p.photo_id),
      });
      sessionStorage.removeItem(photoKey);
      notify("Accession complete · " + card.archive_reference_canonical);
      refresh();
      navigate("item/" + result.record_id);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const chooseField = (field: string) => {
    setActive(field);
    setRemember(false);
    setSide(fields.findIndex((f) => f[0] === field) >= 14 ? 1 : 0);
    setSourceSide(fields.findIndex((f) => f[0] === field) >= 14 ? 1 : 0);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A NEW CHAPTER IN THE COLLECTION</div>
          <h1>Scan & accession</h1>
          <p>From a paper card to a carefully checked archive record.</p>
        </div>
        <button className="button secondary" onClick={() => navigate("new")}>
          Enter a card manually <ArrowRight size={16} />
        </button>
      </div>
      <div className="steps">
        <span className={!scan ? "current" : "done"}>
          <b>{scan ? <Check size={14} /> : "1"}</b> Add a scan
        </span>
        <i />
        <span
          className={
            scan?.status === "processing"
              ? "current"
              : scan?.status === "review"
                ? "done"
                : ""
          }
        >
          <b>2</b> Read the card
        </span>
        <i />
        <span
          className={
            scan?.status === "review" && scan.pending.length ? "current" : ""
          }
        >
          <b>3</b> Review together
        </span>
        <i />
        <span
          className={
            scan?.status === "review" && !scan.pending.length ? "current" : ""
          }
        >
          <b>4</b> Accession
        </span>
      </div>
      {!scan && (
        <div className="upload-layout">
          <section className="upload-panel">
            <div className="section-kicker">
              <ScanLine size={20} />
              <span>YOUR ORIGINAL STAYS WITH THE RECORD</span>
            </div>
            <h2>Let’s read the card.</h2>
            <p>
              Upload a clear, upright image or a PDF. Include the front first
              and the back second.
            </p>
            <div
              className="drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped) setFile(dropped);
              }}
            >
              <div className="upload-icon">
                <Upload size={28} />
              </div>
              <h3>{file ? file.name : "Drop your card here"}</h3>
              <p>
                {file
                  ? `${(file.size / 1024).toFixed(0)} KB · ready for scanning`
                  : "PDF, PNG or JPEG · up to 2 pages · 12 MB maximum"}
              </p>
              <button
                className="button secondary"
                onClick={() => fileInput.current?.click()}
              >
                {file ? "Choose a different file" : "Choose a file"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                aria-label="Upload card file"
                className="visually-hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <label className="layout-select">
              Page layout
              <select
                aria-label="Page layout"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              >
                <option value="card">
                  Collingham card · cropped to the ruled card
                </option>
                <option value="historic">
                  Original A4 society card · recovered layout
                </option>
                <option value="document">
                  Other document · transcribe, then complete the card
                </option>
              </select>
            </label>
            <p className="small-note">
              Choose the ruled training template or the original A4 society-card
              layout. Use “Other document” for different forms, deeds and
              letters. Handwriting always needs a human check.
            </p>
            <button
              className="button primary wide"
              disabled={!file || busy || !status.ocr.tesseract}
              onClick={upload}
            >
              {busy ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <ScanLine size={18} />
              )}{" "}
              Start scanning
            </button>
            {!status.ocr.tesseract && (
              <p className="inline-error">
                The local OCR engine is not installed. Manual accession is
                available.
              </p>
            )}
          </section>
          <aside className="scan-intro">
            <div className="mini-paper">
              <span>COLLINGHAM & DISTRICT</span>
              <h3>
                Small details.
                <br />
                Lasting stories.
              </h3>
              <div className="mini-rule" />
              <p>
                A title. A place. A remembered name.
                <br />
                Each field keeps the object’s story together.
              </p>
              <FileText size={72} strokeWidth={0.8} />
            </div>
            <h3>A familiar card, a little help.</h3>
            <ol>
              <li>
                <b>Keep the original</b>
                <span>
                  Your scan remains available beside the digital record.
                </span>
              </li>
              <li>
                <b>Check uncertain words</b>
                <span>You decide what the handwriting actually says.</span>
              </li>
              <li>
                <b>Build a shared vocabulary</b>
                <span>
                  Remember confirmed spellings for suggestions on later scans.
                </span>
              </li>
            </ol>
            {status.synthetic_demo && (
              <div className="training-links">
                <span className="eyebrow">TRY THE TWO FICTIONAL CARDS</span>
                <a href="/api/demo/cards/1">
                  <Download size={14} /> First accession: a garden deed
                </a>
                <a href="/api/demo/cards/2">
                  <Download size={14} /> Later accession: a walking brochure
                </a>
              </div>
            )}
          </aside>
        </div>
      )}
      {scan?.status === "processing" && (
        <section className="processing-panel" aria-live="polite">
          <div className="scanner-animation">
            <FileText size={82} strokeWidth={1} />
            <span />
          </div>
          <div className="eyebrow">LOCAL OPTICAL SCANNING</div>
          <h2>Reading your card…</h2>
          <p>{scan.filename}</p>
          <div className="processing-detail">
            <Loader2 size={17} className="spin" /> Rendering pages and
            recognising words · {seconds}s
          </div>
          <p className="small-note">
            The next step will show the original, the extracted fields and
            anything that needs a human check.
          </p>
        </section>
      )}
      {scan?.status === "failed" && (
        <section className="empty-state">
          <h2>This scan needs another try.</h2>
          <p>{scan.error}</p>
          <a
            className="button secondary"
            href={"/api/scans/" + scan.scan_id + "/original"}
          >
            Download retained original
          </a>
          <button className="button primary" onClick={() => navigate("scan")}>
            Choose another scan
          </button>
        </section>
      )}
      {scan?.status === "accepted" && (
        <section className="empty-state">
          <CheckCircle2 size={42} />
          <h2>This scan has been accessioned.</h2>
          <button
            className="button primary"
            onClick={() => navigate("item/" + scan.record_id)}
          >
            Open its archive card <ArrowRight size={16} />
          </button>
        </section>
      )}
      {scan?.status === "review" && (
        <>
          <div className="scan-summary">
            <div>
              <span className="status-dot" />
              <b>
                {scan.pending.length
                  ? `${scan.pending.length} fields need your help`
                  : "Every flagged field has been checked"}
              </b>
              <span>
                {scan.pages} pages · read in {scan.elapsed_seconds}s
              </span>
            </div>
            {scan.suggestions.length > 0 && (
              <span className="learned-badge">
                <Lightbulb size={16} /> {scan.suggestions.length} remembered
                spelling suggestions
              </span>
            )}
          </div>
          <div className="scan-layout">
            <div className="source-column">
              <section className="source-panel">
                <div className="panel-toolbar">
                  <div>
                    <span className="eyebrow">ORIGINAL SCAN</span>
                    <strong>{scan.filename}</strong>
                  </div>
                  <div className="source-actions">
                    <button
                      title="Zoom original scan"
                      aria-label="Zoom original scan"
                      className={"icon-button " + (zoom ? "selected" : "")}
                      onClick={() => setZoom(!zoom)}
                    >
                      <ZoomIn size={18} />
                    </button>
                    <a
                      title="Download original"
                      className="icon-button"
                      href={"/api/scans/" + scan.scan_id + "/original"}
                    >
                      <Download size={18} />
                    </a>
                  </div>
                </div>
                <div className="source-tabs">
                  {Array.from({ length: scan.pages }, (_, index) => (
                    <button
                      key={index}
                      className={sourceSide === index ? "selected" : ""}
                      onClick={() => setSourceSide(index)}
                    >
                      Page {index + 1}
                      {scan.profile === "card"
                        ? index === 0
                          ? " · front"
                          : " · back"
                        : ""}
                    </button>
                  ))}
                </div>
                <div className={"source-image " + (zoom ? "zoomed" : "")}>
                  <img
                    src={`/api/scans/${scan.scan_id}/page/${Math.min(sourceSide + 1, scan.pages)}`}
                    alt={`Uploaded source card, page ${sourceSide + 1}`}
                  />
                </div>
                <div className="source-caption">
                  <CheckCircle2 size={14} /> Original file retained ·
                  corrections never change this image
                </div>
              </section>
              <Accuracy scan={scan} />
            </div>
            <div className="review-column">
              <section
                className={
                  "review-panel " +
                  (!scan.pending.length ? "review-complete" : "")
                }
              >
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">HUMAN REVIEW</span>
                    <h2>
                      {scan.pending.length
                        ? "A second pair of eyes."
                        : "Ready for the final check."}
                    </h2>
                  </div>
                  {!scan.pending.length && <CheckCircle2 size={32} />}
                </div>
                <div className="review-chips">
                  {scan.flagged.map((field) => (
                    <button
                      key={field}
                      className={`${active === field ? "selected" : ""} ${scan.reviewed.includes(field) ? "checked" : ""}`}
                      onClick={() => chooseField(field)}
                    >
                      {scan.reviewed.includes(field) && <Check size={12} />}
                      {labels[field]}
                    </button>
                  ))}
                </div>
                {active ? (
                  <div className="word-review">
                    <div className="reading">
                      <span>SCANNER READ</span>
                      <p>{scan.raw_fields[active] || "No text recognised"}</p>
                    </div>
                    {scan.suggestions
                      .filter((s) => s.field === active)
                      .map((s, i) => (
                        <div className="dictionary-hint" key={i}>
                          <Lightbulb size={17} />
                          <span>
                            Remembered from a human correction: <b>{s.raw}</b> →{" "}
                            <b>{s.suggested}</b>
                          </span>
                        </div>
                      ))}
                    <label>
                      Checked reading · {labels[active]}
                      <input
                        aria-label="Checked reading"
                        value={card[active] || ""}
                        onChange={(e) => change(active, e.target.value)}
                      />
                    </label>
                    <div className="review-bottom">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={remember}
                          disabled={
                            active === "archive_reference_canonical" ||
                            card[active] === scan.raw_fields[active] ||
                            !card[active]
                          }
                          onChange={(e) => setRemember(e.target.checked)}
                        />{" "}
                        Remember this spelling for later scans
                      </label>
                      <button
                        className="button primary small"
                        disabled={busy}
                        onClick={review}
                      >
                        {busy ? (
                          <Loader2 size={16} className="spin" />
                        ) : (
                          <Check size={16} />
                        )}{" "}
                        Save checked reading
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>
                    Turn the card over, check all the remaining details and
                    confirm the complete record below.
                  </p>
                )}
              </section>
              <div className="card-toolbar">
                <div>
                  <span className="eyebrow">EDITABLE ARCHIVE CARD</span>
                  <p>Amber fields need review. Every field can be corrected.</p>
                </div>
                <CardSides side={side} onChange={setSide} />
              </div>
              <CardSheet
                value={card}
                onChange={change}
                side={side}
                pending={scan.pending}
                active={active}
                synthetic={status.synthetic_demo || !!scan.benchmark}
              />
            </div>
          </div>
          <section className="accession-panel">
            <PhotoCapture
              photos={photos}
              onChange={(next) => {
                setPhotos(next);
                setVerified(false);
              }}
              onBusy={setPhotoBusy}
              notify={notify}
            />
            <div>
              <span className="eyebrow">COMPLETE THE ACCESSION</span>
              <h2>Give this item its place.</h2>
            </div>
            <CollectionDetails card={card} change={change} />
            <div className="accession-bottom">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  aria-label="I have checked the complete card"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                />{" "}
                I have checked both sides, the accession reference and all
                details against the source.
              </label>
              <button
                className="button primary"
                disabled={
                  busy || photoBusy || !verified || scan.pending.length > 0
                }
                onClick={accession}
              >
                <CheckCircle2 size={18} /> Accession this item
              </button>
            </div>
            <p className="small-note">
              Recorded as checked by{" "}
              {reviewer || "the reviewer named at the top of the workspace"}.{" "}
              {status.synthetic_demo &&
                "This adds a fictional item to the training collection."}
            </p>
          </section>
        </>
      )}
    </>
  );
}

export function ManualAccession({
  status,
  reviewer,
  notify,
  refresh,
  navigate,
}: Omit<Props, "id">) {
  const draftKey = `archive-manual:${status.workspace_id}`;
  const photoKey = draftKey + ":photos";
  const [photos, setPhotos] = usePhotoDraft(photoKey);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [card, setCard] = useState<Card>(() => {
    try {
      return {
        ...blankCard(status.synthetic_demo),
        ...JSON.parse(sessionStorage.getItem(draftKey) || "{}"),
      };
    } catch {
      return blankCard(status.synthetic_demo);
    }
  });
  useEffect(() => {
    sessionStorage.setItem(draftKey, JSON.stringify(card));
  }, [card, draftKey]);
  const [side, setSide] = useState(0);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const change = (key: string, value: string) => {
    setCard((c) => ({ ...c, [key]: value }));
    setVerified(false);
  };
  const save = async () => {
    setBusy(true);
    try {
      const result = await write<{ record_id: number }>("/records", {
        ...card,
        human_verified: verified,
        reviewer,
        photo_ids: photos.map((p) => p.photo_id),
      });
      sessionStorage.removeItem(draftKey);
      sessionStorage.removeItem(photoKey);
      notify("Accession complete · " + card.archive_reference_canonical);
      refresh();
      navigate("item/" + result.record_id);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A NEW ITEM, RECORDED BY YOU</div>
          <h1>Enter an archive card</h1>
          <p>
            The same familiar fields, ready for a photograph, object or
            document.
          </p>
        </div>
        <button className="button secondary" onClick={() => navigate("scan")}>
          Scan a card instead <ScanLine size={16} />
        </button>
      </div>
      <PhotoCapture
        photos={photos}
        onChange={(next) => {
          setPhotos(next);
          setVerified(false);
        }}
        onBusy={setPhotoBusy}
        notify={notify}
      />
      <div className="manual-layout">
        <div>
          <div className="card-toolbar">
            <span className="small-note">Fields marked * are required.</span>
            <CardSides side={side} onChange={setSide} />
          </div>
          <CardSheet
            value={card}
            onChange={change}
            side={side}
            synthetic={status.synthetic_demo}
          />
        </div>
        <aside className="manual-aside">
          <span className="eyebrow">ACCESSION DETAILS</span>
          <h2>A place in the collection.</h2>
          <p>
            Use your archive’s agreed reference. The reference is checked for
            duplicates when you save.
          </p>
          <CollectionDetails card={card} change={change} />
          <div className="tip">
            <Lightbulb size={19} />
            <p>
              The back of the card holds the physical description, size,
              condition and notes. Keep uncertainty visible in the notes.
            </p>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              aria-label="I have checked this manual card"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />{" "}
            I have checked both sides and this card is ready to accession.
          </label>
          <button
            className="button primary wide"
            disabled={!verified || busy || photoBusy}
            onClick={save}
          >
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}{" "}
            Accession this item
          </button>
          <p className="small-note">
            Checked by {reviewer || "the reviewer named at the top"}.
            {status.synthetic_demo && " Fictional training collection."}
          </p>
        </aside>
      </div>
    </>
  );
}
