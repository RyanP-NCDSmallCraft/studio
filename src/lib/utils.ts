import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as dateFnsFormat, isValid } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFirebaseTimestamp(
  dateInput: Timestamp | Date | string | number | undefined | null,
  formatString: string = "PP"
): string {
  if (dateInput === undefined || dateInput === null) {
    return "N/A";
  }

  let dateToFormat: Date;

  if (typeof (dateInput as Timestamp)?.toDate === 'function') {
    // Firestore Timestamp
    dateToFormat = (dateInput as Timestamp).toDate();
  } else if (dateInput instanceof Date) {
    // JavaScript Date
    dateToFormat = dateInput;
  } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    // Attempt to parse if it's an ISO string or a Unix timestamp (milliseconds)
    const parsed = new Date(dateInput);
    if (isValid(parsed)) {
      dateToFormat = parsed;
    } else {
      return "Invalid Date Value";
    }
  } else {
    return "Invalid Date Type";
  }

  if (!isValid(dateToFormat)) {
    return "Invalid Date";
  }

  try {
    return dateFnsFormat(dateToFormat, formatString);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Formatting Error";
  }
}
