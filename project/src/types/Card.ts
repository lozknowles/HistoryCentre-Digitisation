export interface ArchiveCard {
  id: string;
  objectName: string;
  idNumber: string;
  title: string;
  dateReceived: string;
  briefDescription: string;
  donatedBy: string;
  donationDate: string;
  copyright: string;
  associatedPeople: string[];
  associatedPlaces: string[];
  homeLocation: string;
  homeLocationDate: string;
  currentLocation: string;
  currentLocationDate: string;
  physicalDescription: string;
  size: string;
  condition: string;
  notes: string;
  crossReferences: string;
}