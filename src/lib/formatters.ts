import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Format a number with thousands separators and two decimal places
 */
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

/**
 * Format a number with thousands separators (no decimals)
 */
export const formatNumber = (value: number): string => {
  return value.toLocaleString('en-US');
};

/**
 * Format input with thousands separators while typing
 */
export const formatInputNumber = (value: string): string => {
  // Remove all non-digits
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  return parseInt(numbers, 10).toLocaleString('en-US');
};

/**
 * Parse formatted number back to number
 */
export const parseFormattedNumber = (value: string): number => {
  return parseInt(value.replace(/,/g, ''), 10) || 0;
};

/**
 * Parse a date string safely to avoid timezone issues.
 * * Logic: If it's a date-only string (YYYY-MM-DD), forces noon local time to avoid day shift.
 * If it's an ISO timestamp (with time), it relies on the date-fns logic which is more robust
 * for displaying the correct time.
 */
export const parseDateSafe = (dateString: string | null | undefined): Date => {
  if (!dateString) return new Date();
  
  try {
    const str = String(dateString);
    
    // Check if it's a date-only string (DB's date type)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-').map(Number);
      // Create date at 12:00 PM local time to prevent shifting to the previous day
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    
    // For timestamps (created_at), parse directly
    const date = new Date(str);
    if (isNaN(date.getTime())) return new Date();
    return date;
  } catch (e) {
    console.error("Error parsing date:", e);
    return new Date();
  }
};

/**
 * Format a date for display in Spanish locale safely
 */
export const formatDateSafe = (dateString: string | null | undefined, formatStr: string = "d MMM yyyy"): string => {
  const date = parseDateSafe(dateString);
  return format(date, formatStr, { locale: es });
};