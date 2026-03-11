/**
 * Test Time Utility - Provides consistent time references for tests and mock data
 * 
 * This utility ensures that tests remain stable over time by using relative dates
 * based on a fixed reference point rather than hardcoded timestamps.
 */

export interface TimeOffset {
  days?: number;
  hours?: number;
  minutes?: number;
}

export class TestClock {
  private static instance: TestClock;
  private baseTime: Date;

  private constructor(baseTime?: Date) {
    // Use a fixed base time for consistency, defaulting to a date that ensures future events
    // Set base time to be 10 days before current date to ensure generated events are in the future
    this.baseTime = baseTime || new Date(Date.now() - (10 * 24 * 60 * 60 * 1000));
  }

  public static getInstance(baseTime?: Date): TestClock {
    if (!TestClock.instance || baseTime) {
      TestClock.instance = new TestClock(baseTime);
    }
    return TestClock.instance;
  }

  /**
   * Get the base time (reference point for all relative dates)
   */
  public getBaseTime(): Date {
    return new Date(this.baseTime);
  }

  /**
   * Get current time (for real-time operations, can be overridden in tests)
   */
  public getCurrentTime(): Date {
    return new Date();
  }

  /**
   * Get a time relative to the base time
   */
  public getRelativeTime(offset: TimeOffset): Date {
    const result = new Date(this.baseTime);
    
    if (offset.days) {
      result.setDate(result.getDate() + offset.days);
    }
    if (offset.hours) {
      result.setHours(result.getHours() + offset.hours);
    }
    if (offset.minutes) {
      result.setMinutes(result.getMinutes() + offset.minutes);
    }
    
    return result;
  }

  /**
   * Get an ISO string for a time relative to the base time
   */
  public getRelativeTimeISO(offset: TimeOffset): string {
    return this.getRelativeTime(offset).toISOString();
  }

  /**
   * Generate a set of future event times for mock data
   */
  public generateFutureEventTimes() {
    return {
      // Events starting from 30 days in the future
      event1: {
        start: this.getRelativeTimeISO({ days: 30, hours: 18 }),
        end: this.getRelativeTimeISO({ days: 30, hours: 20 }),
        invite: this.getRelativeTimeISO({ days: 27, hours: 18 })
      },
      event2: {
        start: this.getRelativeTimeISO({ days: 35, hours: 18 }),
        end: this.getRelativeTimeISO({ days: 35, hours: 22 }),
        invite: this.getRelativeTimeISO({ days: 32, hours: 18 })
      },
      event3: {
        start: this.getRelativeTimeISO({ days: 40, hours: 16 }),
        end: this.getRelativeTimeISO({ days: 40, hours: 18 }),
        invite: this.getRelativeTimeISO({ days: 37, hours: 16 })
      },
      event4: {
        start: this.getRelativeTimeISO({ days: 45, hours: 9 }),
        end: this.getRelativeTimeISO({ days: 45, hours: 17 }),
        invite: null
      }
    };
  }

  /**
   * Generate past event times for mock data (for testing past event filtering)
   */
  public generatePastEventTimes() {
    return {
      event1: {
        start: this.getRelativeTimeISO({ days: -10, hours: 18 }),
        end: this.getRelativeTimeISO({ days: -10, hours: 20 }),
        invite: this.getRelativeTimeISO({ days: -13, hours: 18 })
      }
    };
  }

  /**
   * Check if a date is in the future relative to current time
   */
  public isFuture(dateString: string): boolean {
    return new Date(dateString) > this.getCurrentTime();
  }

  /**
   * Check if a date is in the past relative to current time
   */
  public isPast(dateString: string): boolean {
    return new Date(dateString) < this.getCurrentTime();
  }

  /**
   * Reset the clock to use a new base time (useful for testing)
   */
  public static resetClock(baseTime?: Date): void {
    TestClock.instance = new TestClock(baseTime);
  }

  /**
   * Set a mock current time (useful for testing time-dependent logic)
   */
  public setMockCurrentTime(mockTime: Date): void {
    this.getCurrentTime = () => new Date(mockTime);
  }

  /**
   * Reset to real current time
   */
  public resetCurrentTime(): void {
    this.getCurrentTime = () => new Date();
  }
}

// Convenience functions for common operations
// These call getInstance() each time to pick up any clock resets.
export const getRelativeTimeISO = (offset: TimeOffset): string => 
  TestClock.getInstance().getRelativeTimeISO(offset);

export const getFutureEventTimes = () => 
  TestClock.getInstance().generateFutureEventTimes();

export const getPastEventTimes = () => 
  TestClock.getInstance().generatePastEventTimes();

export const isFutureDate = (dateString: string): boolean =>
  TestClock.getInstance().isFuture(dateString);

export const isPastDate = (dateString: string): boolean =>
  TestClock.getInstance().isPast(dateString);