import { z } from 'zod';

/**
 * Validation schemas for all forms in the app.
 * Using Zod for type-safe validation with automatic TypeScript inference.
 */

// Player form validation
export const playerSchema = z.object({
  name: z.string()
    .min(1, 'Player name is required')
    .max(100, 'Name must be less than 100 characters'),
  jerseyNumber: z.string()
    .regex(/^\d+$/, 'Jersey number must be a positive number')
    .transform(Number)
    .refine(val => val >= 0 && val <= 999, 'Jersey number must be between 0 and 999'),
  position: z.string()
    .max(50, 'Position must be less than 50 characters')
    .optional(),
  classYear: z.string()
    .regex(/^\d{4}$/, 'Class year must be a 4-digit year')
    .transform(Number)
    .refine(val => val >= 2000 && val <= 2100, 'Enter a valid graduation year')
    .optional()
    .nullable(),
});

export type PlayerFormData = z.infer<typeof playerSchema>;

// Coach form validation
export const coachSchema = z.object({
  name: z.string()
    .min(1, 'Coach name is required')
    .max(100, 'Name must be less than 100 characters'),
  role: z.string()
    .min(1, 'Role is required')
    .max(50, 'Role must be less than 50 characters'),
  email: z.string()
    .email('Invalid email address')
    .optional()
    .nullable(),
  phone: z.string()
    .regex(/^[\d\s\-\(\)]+$/, 'Invalid phone number format')
    .optional()
    .nullable(),
});

export type CoachFormData = z.infer<typeof coachSchema>;

// Game form validation
export const gameSchema = z.object({
  opponent: z.string()
    .min(1, 'Opponent name is required')
    .max(100, 'Opponent name must be less than 100 characters'),
  date: z.string()
    .min(1, 'Game date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string()
    .regex(/^\d{1,2}:\d{2}\s*(AM|PM)$/i, 'Time must be in 12-hour format (e.g., 7:00 PM)'),
  site: z.string()
    .refine(val => ['home', 'away', 'neutral'].includes(val), 'Site must be home, away, or neutral'),
  location: z.string()
    .max(200, 'Location must be less than 200 characters')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
  opponentTeamId: z.string().optional(),
});

export type GameFormData = z.infer<typeof gameSchema>;

// Season form validation
export const seasonSchema = z.object({
  year: z.string()
    .regex(/^\d{4}$/, 'Year must be a 4-digit number')
    .transform(Number)
    .refine(val => val >= 2000 && val <= 2100, 'Enter a valid year'),
  label: z.string()
    .min(1, 'Season label is required')
    .max(50, 'Label must be less than 50 characters'),
  level: z.string()
    .refine(val => ['varsity', 'junior-varsity', 'freshman', 'middle-school', 'youth', 'other'].includes(val), 
      'Level must be one of: varsity, junior-varsity, freshman, middle-school, youth, other'),
  startDate: z.string()
    .min(1, 'Start date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

export type SeasonFormData = z.infer<typeof seasonSchema>;

// Team branding validation
export const brandingSchema = z.object({
  primaryColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Primary color must be a valid hex color (e.g., #FF0000)'),
  secondaryColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Secondary color must be a valid hex color (e.g., #00FF00)'),
  accentColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Accent color must be a valid hex color (e.g., #0000FF)')
    .optional()
    .nullable(),
  logoUrl: z.string()
    .url('Logo must be a valid URL')
    .optional()
    .nullable(),
});

export type BrandingFormData = z.infer<typeof brandingSchema>;

// Opponent form validation
export const opponentSchema = z.object({
  name: z.string()
    .min(1, 'Team name is required')
    .max(100, 'Name must be less than 100 characters'),
  mascot: z.string()
    .max(50, 'Mascot must be less than 50 characters')
    .optional(),
  shortName: z.string()
    .max(20, 'Short name must be less than 20 characters')
    .optional(),
  location: z.string()
    .max(200, 'Location must be less than 200 characters')
    .optional(),
  primaryColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  secondaryColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

export type OpponentFormData = z.infer<typeof opponentSchema>;

// Helper to get first error message from Zod validation
export const getFirstError = (errors: any, fieldName: string): string | undefined => {
  return errors[fieldName]?.message;
};
