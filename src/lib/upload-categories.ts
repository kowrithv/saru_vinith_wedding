// Shared (client-safe) list of guest-upload categories — kept in sync with the
// event passwords in src/lib/event-passwords.ts (server-only, reads env vars).
export const uploadCategories = ['Empfang'] as const
export type UploadCategory = (typeof uploadCategories)[number]
