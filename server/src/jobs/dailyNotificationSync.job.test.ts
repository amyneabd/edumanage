import { afterEach, describe, expect, it, vi } from "vitest";

const { runDailyNotificationSyncMock } = vi.hoisted(() => ({
  runDailyNotificationSyncMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/notification.service.js", () => ({ runDailyNotificationSync: runDailyNotificationSyncMock }));

const { startDailyNotificationSyncJob } = await import("./dailyNotificationSync.job.js");

afterEach(() => {
  vi.useRealTimers();
  runDailyNotificationSyncMock.mockClear();
});

describe("startDailyNotificationSyncJob", () => {
  it("does not run the sync immediately on start", () => {
    vi.useFakeTimers();
    startDailyNotificationSyncJob();
    expect(runDailyNotificationSyncMock).not.toHaveBeenCalled();
  });

  it("runs the sync every 24 hours", () => {
    vi.useFakeTimers();
    startDailyNotificationSyncJob();

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(runDailyNotificationSyncMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(runDailyNotificationSyncMock).toHaveBeenCalledTimes(2);
  });
});
