import { type ClassValue, clsx } from 'clsx'

/**
 * Joins class names. Plain clsx, no tailwind-merge: building its rules took a noticeable share of
 * the home page's start-up, and no component relies on one class overriding another.
 */
export const cn = (...inputs: ClassValue[]) => clsx(inputs)
