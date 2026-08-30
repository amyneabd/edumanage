import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError } from "./FieldError";

describe("FieldError", () => {
  it("renders nothing when there is no message", () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message when provided", () => {
    render(<FieldError message="Enter a valid email address." />);
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });
});
