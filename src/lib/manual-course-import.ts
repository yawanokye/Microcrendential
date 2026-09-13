/**
 * Compatibility placeholder for repositories upgraded by uploading files over
 * an older release. Manual import now lives in
 * src/app/api/course-design/from-manual/route.ts and starts from
 * defaultCourseDesign(), which includes the required creditValue field.
 *
 * Keeping this path prevents an obsolete, locally retained implementation from
 * being type-checked by Next.js after an in-place GitHub upload.
 */
export {};
