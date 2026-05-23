import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

// Initialize database
const db = new Database('archive.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    objectName TEXT NOT NULL,
    idNumber TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    dateReceived TEXT NOT NULL,
    briefDescription TEXT,
    donatedBy TEXT,
    donationDate TEXT,
    copyright TEXT,
    associatedPeople TEXT,
    associatedPlaces TEXT,
    homeLocation TEXT,
    homeLocationDate TEXT,
    currentLocation TEXT,
    currentLocationDate TEXT,
    physicalDescription TEXT,
    size TEXT,
    condition TEXT,
    notes TEXT,
    crossReferences TEXT
  );

  CREATE TABLE IF NOT EXISTS checkouts (
    id TEXT PRIMARY KEY,
    itemId TEXT NOT NULL,
    checkedOutBy TEXT NOT NULL,
    checkedOutDate TEXT NOT NULL,
    checkedInDate TEXT,
    notes TEXT,
    FOREIGN KEY (itemId) REFERENCES cards(idNumber)
  );
`);

// Import initial data if tables are empty
const cardsCount = db.prepare('SELECT COUNT(*) as count FROM cards').get().count;
const checkoutsCount = db.prepare('SELECT COUNT(*) as count FROM checkouts').get().count;

if (cardsCount === 0) {
  const cards = JSON.parse(readFileSync('public/data/cards.json', 'utf-8'));
  const insertCard = db.prepare(`
    INSERT INTO cards (
      id, objectName, idNumber, title, dateReceived, briefDescription,
      donatedBy, donationDate, copyright, associatedPeople, associatedPlaces,
      homeLocation, homeLocationDate, currentLocation, currentLocationDate,
      physicalDescription, size, condition, notes, crossReferences
    ) VALUES (
      @id, @objectName, @idNumber, @title, @dateReceived, @briefDescription,
      @donatedBy, @donationDate, @copyright, @associatedPeople, @associatedPlaces,
      @homeLocation, @homeLocationDate, @currentLocation, @currentLocationDate,
      @physicalDescription, @size, @condition, @notes, @crossReferences
    )
  `);

  const insertCards = db.transaction((cards) => {
    for (const card of cards) {
      insertCard.run({
        ...card,
        associatedPeople: JSON.stringify(card.associatedPeople),
        associatedPlaces: JSON.stringify(card.associatedPlaces)
      });
    }
  });

  insertCards(cards);
  console.log(`Imported ${cards.length} cards`);
}

if (checkoutsCount === 0) {
  const checkouts = JSON.parse(readFileSync('public/data/checkouts.json', 'utf-8'));
  const insertCheckout = db.prepare(`
    INSERT INTO checkouts (
      id, itemId, checkedOutBy, checkedOutDate, checkedInDate, notes
    ) VALUES (
      @id, @itemId, @checkedOutBy, @checkedOutDate, @checkedInDate, @notes
    )
  `);

  const insertCheckouts = db.transaction((checkouts) => {
    for (const checkout of checkouts) {
      insertCheckout.run(checkout);
    }
  });

  insertCheckouts(checkouts);
  console.log(`Imported ${checkouts.length} checkouts`);
}

console.log('Database initialized successfully');