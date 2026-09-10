import { getCheckouts as dbGetCheckouts, saveCheckout as dbSaveCheckout, isItemCheckedOut as dbIsItemCheckedOut } from './db';
import type { Checkout } from '../types/Checkout';

export const loadCheckouts = async (): Promise<Checkout[]> => {
  try {
    return dbGetCheckouts();
  } catch (error) {
    console.error('Error loading checkouts:', error);
    return [];
  }
};

export const saveCheckout = async (checkout: Checkout): Promise<boolean> => {
  try {
    return dbSaveCheckout(checkout);
  } catch (error) {
    console.error('Error saving checkout:', error);
    return false;
  }
};

export const isItemCheckedOut = (itemId: string): Promise<boolean> => {
  return dbIsItemCheckedOut(itemId);
};
