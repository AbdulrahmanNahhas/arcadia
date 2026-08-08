import { join, resolve } from "node:path";
import Database from "better-sqlite3";

// Resolve database path from environment or default path
const databasePath = resolve(
  process.env.ARCADIA_DB_PATH ?? join(process.cwd(), "data", "arcadia.db"),
);

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");

interface TermRow {
  id: string;
  vocabulary: string;
  name: string;
  slug: string;
}

/**
 * Transforms 'title-title' or 'title_title' into 'Title Title'
 * and 'hjhsd' into 'Hjhsd'.
 */
function formatTagName(raw: string): string {
  return raw
    .trim()
    .replace(/[-_]+/g, " ") // Replace hyphens and underscores with spaces
    .split(/\s+/) // Split into individual words
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Converts formatted string back to a clean kebab-case slug.
 */
function toSlug(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

console.log(`📁 Connecting to database at: ${databasePath}`);

const runTagFormatter = db.transaction(() => {
  // Fetch all existing tags
  const tagTerms = db
    .prepare<[string], TermRow>("SELECT id, vocabulary, name, slug FROM terms WHERE vocabulary = ?")
    .all("tag");

  console.log(`🔍 Found ${tagTerms.length} tags to format...`);

  // Group tags by their target slug to detect and handle duplicates
  const grouped = new Map<string, { term: TermRow; newName: string }[]>();

  for (const term of tagTerms) {
    const newName = formatTagName(term.name);
    const newSlug = toSlug(newName);

    const list = grouped.get(newSlug) ?? [];
    list.push({ term, newName });
    grouped.set(newSlug, list);
  }

  let updatedCount = 0;
  let mergedCount = 0;

  // Prepared statements
  const updateTermStmt = db.prepare("UPDATE terms SET name = ?, slug = ? WHERE id = ?");
  const updateWorkTermStmt = db.prepare(
    "UPDATE OR IGNORE work_terms SET term_id = ? WHERE term_id = ?",
  );
  const deleteWorkTermStmt = db.prepare("DELETE FROM work_terms WHERE term_id = ?");
  const deleteTermStmt = db.prepare("DELETE FROM terms WHERE id = ?");

  for (const [newSlug, entries] of grouped.entries()) {
    const primary = entries[0];

    // Deduplicate if multiple tags format to the same slug
    if (entries.length > 1) {
      for (let i = 1; i < entries.length; i++) {
        const duplicate = entries[i].term;

        updateWorkTermStmt.run(primary.term.id, duplicate.id);
        deleteWorkTermStmt.run(duplicate.id);
        deleteTermStmt.run(duplicate.id);
        mergedCount++;
      }
    }

    // Update primary tag's name & slug if changed
    if (primary.term.name !== primary.newName || primary.term.slug !== newSlug) {
      updateTermStmt.run(primary.newName, newSlug, primary.term.id);
      updatedCount++;
    }
  }

  return { totalProcessed: tagTerms.length, updatedCount, mergedCount };
});

try {
  const result = runTagFormatter();
  console.log("✅ Tag formatting complete!");
  console.log(`   - Total tags processed: ${result.totalProcessed}`);
  console.log(`   - Tags formatted to Title Case: ${result.updatedCount}`);
  console.log(`   - Duplicate tags merged: ${result.mergedCount}`);
} catch (error) {
  console.error("❌ Failed to format tags:", error);
} finally {
  db.close();
}
