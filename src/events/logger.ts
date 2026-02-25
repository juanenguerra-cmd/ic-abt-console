import { v4 as uuidv4 } from "uuid";
import { ISO } from "../domain/models";

export type AppEventType = 
  | "db_mutation" 
  | "audit_started" 
  | "audit_completed" 
  | "facility_changed" 
  | "export_generated";

export interface AppEvent {
  id: string;
  timestamp: ISO;
  type: AppEventType;
  facilityId?: string;
  userId?: string;
  payload: Record<string, any>;
}

const EVENTS_STORAGE_KEY = "UNIFIED_DB_EVENTS";

/**
 * Append-only event tracking system capturing DB mutations, audits, 
 * facility changes, and export generation.
 */
export const EventLogger = {
  /**
   * Appends a new event to the log.
   */
  log: (type: AppEventType, payload: Record<string, any>, facilityId?: string, userId?: string): void => {
    const event: AppEvent = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type,
      facilityId,
      userId,
      payload
    };

    try {
      const existingRaw = localStorage.getItem(EVENTS_STORAGE_KEY);
      const events: AppEvent[] = existingRaw ? JSON.parse(existingRaw) : [];
      
      events.push(event);
      
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.error("EventLogger: Failed to append event to log. Storage quota may be exceeded.", e);
    }
  },
  
  /**
   * Retrieves all events from the log.
   */
  getEvents: (): AppEvent[] => {
    try {
      const existingRaw = localStorage.getItem(EVENTS_STORAGE_KEY);
      return existingRaw ? JSON.parse(existingRaw) : [];
    } catch (e) {
      console.error("EventLogger: Failed to read event log.", e);
      return [];
    }
  },

  /**
   * Clears the event log. (Use with caution, typically only for hard resets).
   */
  clearLogs: (): void => {
    localStorage.removeItem(EVENTS_STORAGE_KEY);
  }
};
