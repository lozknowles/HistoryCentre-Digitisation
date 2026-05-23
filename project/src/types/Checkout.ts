export interface Checkout {
  id: string;
  itemId: string;
  checkedOutBy: string;
  checkedOutDate: string;
  checkedInDate?: string;
  notes?: string;
}