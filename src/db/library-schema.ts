import type {DatabaseSync} from "node:sqlite";
export function migrateLibrary(db:DatabaseSync){db.exec(`
CREATE TABLE IF NOT EXISTS library_bookmarks(user_email TEXT NOT NULL,resource_id TEXT NOT NULL,resource_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_email,resource_id));
CREATE TABLE IF NOT EXISTS library_readings(id INTEGER PRIMARY KEY AUTOINCREMENT,course_code TEXT NOT NULL,resource_json TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS library_readings_course ON library_readings(course_code);
CREATE TABLE IF NOT EXISTS library_search_cache(cache_key TEXT PRIMARY KEY,result_json TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS library_usage(day TEXT NOT NULL,user_email TEXT NOT NULL,calls INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,user_email));
CREATE TABLE IF NOT EXISTS library_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 1,daily_limit INTEGER NOT NULL DEFAULT 80);
INSERT OR IGNORE INTO library_settings(id) VALUES(1);
`);}
