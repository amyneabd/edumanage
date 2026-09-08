import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushToggle } from "./PushToggle";

const { usePushSubscriptionMock } = vi.hoisted(() => ({ usePushSubscriptionMock: vi.fn() }));
vi.mock("../hooks/usePushSubscription", () => ({ usePushSubscription: usePushSubscriptionMock }));

afterEach(() => {
  cleanup();
  usePushSubscriptionMock.mockReset();
});

describe("PushToggle", () => {
  it("renders nothing when the browser doesn't support push", () => {
    usePushSubscriptionMock.mockReturnValue({ status: "unsupported", enable: vi.fn(), disable: vi.fn() });
    const { container } = render(<PushToggle role="teacher" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an inline message when permission was denied", () => {
    usePushSubscriptionMock.mockReturnValue({ status: "denied", enable: vi.fn(), disable: vi.fn() });
    render(<PushToggle role="teacher" />);
    expect(screen.getByText(/notifications bloquées/i)).toBeInTheDocument();
  });

  it("shows an inline message when push notifications are unconfigured server-side", () => {
    usePushSubscriptionMock.mockReturnValue({ status: "unconfigured", enable: vi.fn(), disable: vi.fn() });
    render(<PushToggle role="teacher" />);
    expect(screen.getByText(/notifications push non configurées/i)).toBeInTheDocument();
  });

  it("shows a subscribe button and calls enable() when not yet subscribed", async () => {
    const user = userEvent.setup();
    const enable = vi.fn();
    usePushSubscriptionMock.mockReturnValue({ status: "unsubscribed", enable, disable: vi.fn() });
    render(<PushToggle role="parent" />);

    const button = screen.getByRole("button", { name: "Activer les notifications push" });
    await user.click(button);

    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("shows a subscribed state and calls disable() when already subscribed", async () => {
    const user = userEvent.setup();
    const disable = vi.fn();
    usePushSubscriptionMock.mockReturnValue({ status: "subscribed", enable: vi.fn(), disable });
    render(<PushToggle role="parent" />);

    const button = screen.getByRole("button", { name: "Désactiver les notifications push" });
    await user.click(button);

    expect(disable).toHaveBeenCalledTimes(1);
  });
});
