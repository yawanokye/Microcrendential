// Keep the legacy import path pointed at the single database implementation.
// This prevents two module-local RenderDatabase classes from declaring the
// same global cache variable during TypeScript compilation.
export { getRawDb, getRawDb as getDb } from "@/db/raw";
