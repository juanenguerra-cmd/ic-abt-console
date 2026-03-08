import { UnifiedDB } from "../storage/engine";

// The local Node.js server will run on port 3001
const API_BASE_URL = "http://localhost:3001/api";

/**
 * Fetches the entire database from the remote server.
 */
export const remoteFetchDb = async (): Promise<UnifiedDB> => {
  const response = await fetch(`${API_BASE_URL}/db`);
  if (!response.ok) {
    throw new Error("Failed to fetch database from server.");
  }
  // The server might return an empty object if the DB file doesn't exist yet
  const responseBody = await response.text();
  if (!responseBody || responseBody === '{}') {
      // If the response is empty or just an empty object, treat it as a non-existent DB
      // This will trigger the logic to use a local DB or create a new one.
      throw new Error("Remote database is empty or not found.");
  }
  return JSON.parse(responseBody);
};

/**
 * Saves the entire database to the remote server.
 * @param db The database object to save.
 */
export const remoteSaveDb = async (db: UnifiedDB): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/db`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(db),
  });

  if (!response.ok) {
    throw new Error("Failed to save database to server.");
  }
};
