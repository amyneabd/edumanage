import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleView } from "./ScheduleView";

describe("ScheduleView", () => {
  it("renders a weekly 7-day grid when mode is weekly", () => {
    render(
      <ScheduleView data={{ mode: "weekly", slots: [{ dayOfWeek: 1, startTime: "16:00", endTime: "17:00" }] }} />
    );
    expect(screen.getByText("16:00")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("shows the empty state when weekly mode has no slots", () => {
    render(<ScheduleView data={{ mode: "weekly", slots: [] }} />);
    expect(screen.getByText("No schedule set yet")).toBeInTheDocument();
  });

  it("renders a dated list when mode is vacation", () => {
    render(
      <ScheduleView
        data={{ mode: "vacation", sessions: [{ date: "2026-10-05", startTime: "14:00", endTime: "15:00" }] }}
      />
    );
    expect(screen.getByText("14:00–15:00")).toBeInTheDocument();
  });

  it("shows a vacation-specific empty state when vacation mode has no sessions", () => {
    render(<ScheduleView data={{ mode: "vacation", sessions: [] }} />);
    expect(screen.getByText("No vacation sessions scheduled yet")).toBeInTheDocument();
  });
});
