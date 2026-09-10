import { Card, fields } from "./model";

export function CardSheet({
  value,
  onChange,
  side,
  pending = [],
  active,
  synthetic = false,
}: {
  value: Card;
  onChange?: (key: string, value: string) => void;
  side: number;
  pending?: string[];
  active?: string;
  synthetic?: boolean;
}) {
  return (
    <section
      className="paper-card"
      aria-label={side === 0 ? "Front of archive card" : "Back of archive card"}
    >
      <header className="paper-heading">
        <h2>
          Collingham and District
          <br />
          Local History Society
        </h2>
        <p>
          ARCHIVE RECORD CARD <span>•</span> {side === 0 ? "FRONT" : "BACK"}
          {synthetic && " • FICTIONAL TRAINING ITEM"}
        </p>
      </header>
      <div className="ruled-fields">
        {fields
          .slice(side === 0 ? 0 : 14, side === 0 ? 14 : undefined)
          .map(([key, label, span]) => {
            const long = [
              "brief_description",
              "physical_description",
              "notes",
            ].includes(key);
            return (
              <div
                key={key}
                className={`ruled-field span-${span} ${long ? "long-field" : ""} ${pending.includes(key) ? "needs-check" : ""} ${active === key ? "active-field" : ""}`}
              >
                <label htmlFor={"card-" + key}>
                  {label}
                  {[
                    "object_name",
                    "archive_reference_canonical",
                    "title",
                  ].includes(key) && onChange
                    ? " *"
                    : ""}
                  {pending.includes(key) && (
                    <span className="field-dot" title="Human check needed" />
                  )}
                </label>
                {onChange ? (
                  <textarea
                    id={"card-" + key}
                    aria-label={label + (label === "Date" ? " - " + key : "")}
                    value={value[key] || ""}
                    rows={long ? 3 : 1}
                    onChange={(e) => onChange(key, e.target.value)}
                    placeholder="—"
                  />
                ) : (
                  <div className="field-text">
                    {value[key] || <span className="blank-value">—</span>}
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <footer className="paper-footer">
        {onChange
          ? "An editable digital counterpart of the society’s original card."
          : "Recorded with care. Preserved with context."}
      </footer>
    </section>
  );
}

export function CardSides({
  side,
  onChange,
}: {
  side: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="segmented" aria-label="Card side">
      <button
        className={side === 0 ? "selected" : ""}
        onClick={() => onChange(0)}
      >
        Front of card
      </button>
      <button
        className={side === 1 ? "selected" : ""}
        onClick={() => onChange(1)}
      >
        Back of card
      </button>
    </div>
  );
}
