import { describe, test, expect, beforeEach } from '@jest/globals';
import { TestClock, getRelativeTimeISO, getFutureEventTimes, isFutureDate, isPastDate } from '../../src/test-time.js';

describe('TestClock', () => {
  let testClock: TestClock;

  beforeEach(() => {
    // Reset to a known base time for consistent testing
    TestClock.resetClock(new Date('2025-01-01T12:00:00.000Z'));
    testClock = TestClock.getInstance();
  });

  describe('Base Time Management', () => {
    test('should provide consistent base time', () => {
      const baseTime = testClock.getBaseTime();
      expect(baseTime.toISOString()).toBe('2025-01-01T12:00:00.000Z');
    });

    test('should allow custom base time', () => {
      const customBase = new Date('2024-06-15T10:30:00.000Z');
      TestClock.resetClock(customBase);
      const clock = TestClock.getInstance();
      
      expect(clock.getBaseTime().toISOString()).toBe('2024-06-15T10:30:00.000Z');
    });
  });

  describe('Relative Time Generation', () => {
    test('should generate future dates correctly', () => {
      const futureDate = testClock.getRelativeTime({ days: 30, hours: 6 });
      
      expect(futureDate.toISOString()).toBe('2025-01-31T18:00:00.000Z');
    });

    test('should generate past dates correctly', () => {
      const pastDate = testClock.getRelativeTime({ days: -10, hours: -2 });
      
      expect(pastDate.toISOString()).toBe('2024-12-22T10:00:00.000Z');
    });

    test('should handle minutes and complex offsets', () => {
      const complexDate = testClock.getRelativeTime({ 
        days: 5, 
        hours: 3, 
        minutes: 45 
      });
      
      expect(complexDate.toISOString()).toBe('2025-01-06T15:45:00.000Z');
    });
  });

  describe('Future Event Times Generation', () => {
    test('should generate consistent future event times', () => {
      const eventTimes = testClock.generateFutureEventTimes();
      
      // All events should be in the future relative to base time
      expect(new Date(eventTimes.event1.start) > testClock.getBaseTime()).toBe(true);
      expect(new Date(eventTimes.event2.start) > testClock.getBaseTime()).toBe(true);
      expect(new Date(eventTimes.event3.start) > testClock.getBaseTime()).toBe(true);
      expect(new Date(eventTimes.event4.start) > testClock.getBaseTime()).toBe(true);
      
      // Events should be properly ordered
      expect(new Date(eventTimes.event1.start) < new Date(eventTimes.event2.start)).toBe(true);
      expect(new Date(eventTimes.event2.start) < new Date(eventTimes.event3.start)).toBe(true);
      expect(new Date(eventTimes.event3.start) < new Date(eventTimes.event4.start)).toBe(true);
    });

    test('should have consistent invite times before event times', () => {
      const eventTimes = testClock.generateFutureEventTimes();
      
      // Invite times should be before start times (except for event4 which has null invite)
      expect(new Date(eventTimes.event1.invite!) < new Date(eventTimes.event1.start)).toBe(true);
      expect(new Date(eventTimes.event2.invite!) < new Date(eventTimes.event2.start)).toBe(true);
      expect(new Date(eventTimes.event3.invite!) < new Date(eventTimes.event3.start)).toBe(true);
      expect(eventTimes.event4.invite).toBeNull();
    });
  });

  describe('Date Comparison Functions', () => {
    test('should correctly identify future dates when using mock current time', () => {
      // Set mock current time to base time
      testClock.setMockCurrentTime(testClock.getBaseTime());
      
      const futureDate = testClock.getRelativeTimeISO({ days: 1 });
      const pastDate = testClock.getRelativeTimeISO({ days: -1 });
      
      expect(testClock.isFuture(futureDate)).toBe(true);
      expect(testClock.isFuture(pastDate)).toBe(false);
      expect(testClock.isPast(pastDate)).toBe(true);
      expect(testClock.isPast(futureDate)).toBe(false);
    });
  });

  describe('Convenience Functions', () => {
    test('should provide working convenience functions', () => {
      const testClock = TestClock.getInstance();
      const baseTime = testClock.getBaseTime();
      const expectedTime = new Date(baseTime);
      expectedTime.setDate(expectedTime.getDate() + 15);
      expectedTime.setHours(expectedTime.getHours() + 12);
      
      const relativeTime = getRelativeTimeISO({ days: 15, hours: 12 });
      expect(relativeTime).toBe(expectedTime.toISOString());
      
      const futureEvents = getFutureEventTimes();
      expect(futureEvents.event1).toBeDefined();
      expect(futureEvents.event1.start).toBeDefined();
    });
  });

  describe('Clock Reset and Isolation', () => {
    test('should maintain isolation between test runs', () => {
      const originalBase = testClock.getBaseTime();
      
      // Modify clock
      TestClock.resetClock(new Date('2024-12-25T00:00:00.000Z'));
      const modifiedClock = TestClock.getInstance();
      
      expect(modifiedClock.getBaseTime().toISOString()).toBe('2024-12-25T00:00:00.000Z');
      expect(modifiedClock.getBaseTime()).not.toEqual(originalBase);
    });
  });
});