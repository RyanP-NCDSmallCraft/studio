
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

// CSV Utility Functions

function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  let stringValue = String(value);
  // If the value contains a comma, a double quote, or a newline, wrap it in double quotes
  // and escape any existing double quotes by doubling them (e.g., " becomes "").
  if (/[",\n\r]/.test(stringValue)) {
    stringValue = `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function convertToCSV(data: any[], columns?: string[]): string {
  if (!data || data.length === 0) {
    return "";
  }

  const headers = columns || Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.map(escapeCSVValue).join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => escapeCSVValue(row[header]));
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export function downloadCSV(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
