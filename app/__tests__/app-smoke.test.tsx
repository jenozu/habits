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
  beforeEach(() => window.localStorage.clear());

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
});
