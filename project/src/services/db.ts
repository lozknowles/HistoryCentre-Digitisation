import initSqlJs from 'sql.js/dist/sql-wasm.js';
import type { Database } from 'sql.js';
import type { ArchiveCard } from '../types/Card';
import type { Checkout } from '../types/Checkout';

let dbInstance: Database | null = null;
const DB_KEY = 'archiveDb';

const initDb = async (): Promise<Database> => {
  if (dbInstance) return dbInstance;

  try {
    const SQL = await initSqlJs({
      locateFile: file => `${import.meta.env.BASE_URL}sql.js/${file}`
    });

    let db: Database;

    // Try to load existing database from localStorage
    const savedDb = localStorage.getItem(DB_KEY);
    if (savedDb) {
      try {
        const buffer = Uint8Array.from(savedDb.split(',').map(Number));
        db = new SQL.Database(buffer);
      } catch (e) {
        console.warn('Failed to load database from localStorage, creating new one');
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    // Create tables
    db.run(`
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
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS checkouts (
        id TEXT PRIMARY KEY,
        itemId TEXT NOT NULL,
        checkedOutBy TEXT NOT NULL,
        checkedOutDate TEXT NOT NULL,
        checkedInDate TEXT,
        notes TEXT,
        FOREIGN KEY (itemId) REFERENCES cards(idNumber)
      )
    `);

    // Check if cards table is empty
    const result = db.exec("SELECT COUNT(*) FROM cards");
    if (result[0].values[0][0] === 0) {
      const response = await fetch(`${import.meta.env.BASE_URL}data/cards.json`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const cards: ArchiveCard[] = await response.json();
      
      const stmt = db.prepare(`
        INSERT INTO cards VALUES (
          $id, $objectName, $idNumber, $title, $dateReceived, $briefDescription,
          $donatedBy, $donationDate, $copyright, $associatedPeople, $associatedPlaces,
          $homeLocation, $homeLocationDate, $currentLocation, $currentLocationDate,
          $physicalDescription, $size, $condition, $notes, $crossReferences
        )
      `);

      cards.forEach(card => {
        stmt.run({
          $id: card.id,
          $objectName: card.objectName,
          $idNumber: card.idNumber,
          $title: card.title,
          $dateReceived: card.dateReceived,
          $briefDescription: card.briefDescription || '',
          $donatedBy: card.donatedBy || '',
          $donationDate: card.donationDate || '',
          $copyright: card.copyright || '',
          $associatedPeople: JSON.stringify(card.associatedPeople || []),
          $associatedPlaces: JSON.stringify(card.associatedPlaces || []),
          $homeLocation: card.homeLocation || '',
          $homeLocationDate: card.homeLocationDate || '',
          $currentLocation: card.currentLocation || '',
          $currentLocationDate: card.currentLocationDate || '',
          $physicalDescription: card.physicalDescription || '',
          $size: card.size || '',
          $condition: card.condition || '',
          $notes: card.notes || '',
          $crossReferences: card.crossReferences || ''
        });
      });

      stmt.free();
      saveToLocalStorage(db);
    }

    dbInstance = db;
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

const saveToLocalStorage = (db: Database) => {
  try {
    const data = db.export();
    const arr = Array.from(data);
    localStorage.setItem(DB_KEY, arr.toString());
  } catch (error) {
    console.error('Failed to save database to localStorage:', error);
  }
};

export const getCards = async (): Promise<ArchiveCard[]> => {
  try {
    const db = await initDb();
    const result = db.exec('SELECT * FROM cards ORDER BY idNumber');
    if (!result.length) return [];

    return result[0].values.map(row => ({
      id: row[0] as string,
      objectName: row[1] as string,
      idNumber: row[2] as string,
      title: row[3] as string,
      dateReceived: row[4] as string,
      briefDescription: row[5] as string,
      donatedBy: row[6] as string,
      donationDate: row[7] as string,
      copyright: row[8] as string,
      associatedPeople: JSON.parse(row[9] as string || '[]'),
      associatedPlaces: JSON.parse(row[10] as string || '[]'),
      homeLocation: row[11] as string,
      homeLocationDate: row[12] as string,
      currentLocation: row[13] as string,
      currentLocationDate: row[14] as string,
      physicalDescription: row[15] as string,
      size: row[16] as string,
      condition: row[17] as string,
      notes: row[18] as string,
      crossReferences: row[19] as string
    }));
  } catch (error) {
    console.error('Failed to get cards:', error);
    return [];
  }
};

export const saveCard = async (card: ArchiveCard): Promise<boolean> => {
  try {
    const db = await initDb();
    db.run(`
      INSERT OR REPLACE INTO cards VALUES (
        $id, $objectName, $idNumber, $title, $dateReceived, $briefDescription,
        $donatedBy, $donationDate, $copyright, $associatedPeople, $associatedPlaces,
        $homeLocation, $homeLocationDate, $currentLocation, $currentLocationDate,
        $physicalDescription, $size, $condition, $notes, $crossReferences
      )
    `, {
      $id: card.id,
      $objectName: card.objectName,
      $idNumber: card.idNumber,
      $title: card.title,
      $dateReceived: card.dateReceived,
      $briefDescription: card.briefDescription || '',
      $donatedBy: card.donatedBy || '',
      $donationDate: card.donationDate || '',
      $copyright: card.copyright || '',
      $associatedPeople: JSON.stringify(card.associatedPeople || []),
      $associatedPlaces: JSON.stringify(card.associatedPlaces || []),
      $homeLocation: card.homeLocation || '',
      $homeLocationDate: card.homeLocationDate || '',
      $currentLocation: card.currentLocation || '',
      $currentLocationDate: card.currentLocationDate || '',
      $physicalDescription: card.physicalDescription || '',
      $size: card.size || '',
      $condition: card.condition || '',
      $notes: card.notes || '',
      $crossReferences: card.crossReferences || ''
    });

    saveToLocalStorage(db);
    return true;
  } catch (error) {
    console.error('Failed to save card:', error);
    return false;
  }
};

export const getCheckouts = async (): Promise<Checkout[]> => {
  try {
    const db = await initDb();
    const result = db.exec('SELECT * FROM checkouts ORDER BY checkedOutDate DESC');
    if (!result.length) return [];

    return result[0].values.map(row => ({
      id: row[0] as string,
      itemId: row[1] as string,
      checkedOutBy: row[2] as string,
      checkedOutDate: row[3] as string,
      checkedInDate: row[4] as string,
      notes: row[5] as string
    }));
  } catch (error) {
    console.error('Failed to get checkouts:', error);
    return [];
  }
};

export const saveCheckout = async (checkout: Checkout): Promise<boolean> => {
  try {
    const db = await initDb();
    
    // Check if item is already checked out
    if (!checkout.checkedInDate) {
      const existing = db.exec(`
        SELECT COUNT(*) FROM checkouts 
        WHERE itemId = ? AND checkedInDate IS NULL
      `, [checkout.itemId]);
      
      if (Number(existing[0].values[0][0]) > 0) {
        throw new Error('Item is already checked out');
      }
    }

    db.run(`
      INSERT OR REPLACE INTO checkouts VALUES (
        $id, $itemId, $checkedOutBy, $checkedOutDate, $checkedInDate, $notes
      )
    `, {
      $id: checkout.id,
      $itemId: checkout.itemId,
      $checkedOutBy: checkout.checkedOutBy,
      $checkedOutDate: checkout.checkedOutDate,
      $checkedInDate: checkout.checkedInDate || null,
      $notes: checkout.notes || ''
    });

    saveToLocalStorage(db);
    return true;
  } catch (error) {
    console.error('Failed to save checkout:', error);
    throw error;
  }
};

export const isItemCheckedOut = async (itemId: string): Promise<boolean> => {
  try {
    const db = await initDb();
    const result = db.exec(`
      SELECT COUNT(*) FROM checkouts 
      WHERE itemId = ? AND checkedInDate IS NULL
    `, [itemId]);
    
    return Number(result[0].values[0][0]) > 0;
  } catch (error) {
    console.error('Failed to check item status:', error);
    return false;
  }
};
