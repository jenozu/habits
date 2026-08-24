import { fireEvent, render, screen } from "@testing-library/react";
import HabitApp from "../habit-app";
import fixture from "./fixtures/v2.json";
import { V2_STORAGE_KEY } from "../storage/app-store";

vi.mock("../media-store", () => ({
  getMedia: vi.fn().mockResolvedValue(null),
  saveMedia: vi.fn().mockResolvedValue(undefined),
  deleteMedia: vi.fn().mockResolvedValue(undefined),
}));

describe("app foundation integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("starts with general routines and keeps trading manually activated", async () => {
    render(<HabitApp />);
    expect(await screen.findByText("Morning routine")).toBeTruthy();
    expect(screen.getByText("Trading discipline")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activate" })).toBeTruthy();
  });

  it("hydrates a V2 fixture without losing its journal entry", async () => {
    window.localStorage.setItem(V2_STORAGE_KEY, JSON.stringify(fixture));
    render(<HabitApp />);
    expect(await screen.findByText("Morning routine")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Journal" }));
    expect(await screen.findByText("A day")).toBeTruthy();
  });

  it("opens routine details from the card header without blocking check-ins", async () => {
    render(<HabitApp />);
    const openDetails = await screen.findByRole("button", { name: "Open Morning routine details" });
    fireEvent.click(openDetails);
    expect(await screen.findByRole("heading", { name: "Morning routine" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /All routines/ })).toBeTruthy();
  });

  it("switches the dashboard between day and week views", async () => {
    render(<HabitApp />);
    const weekButton = await screen.findByRole("button", { name: "Week" });
    fireEvent.click(weekButton);
    expect(weekButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Consistency by day" })).toBeTruthy();
  });
});
