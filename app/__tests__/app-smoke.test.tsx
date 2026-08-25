import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HabitApp from "../habit-app";
import fixture from "./fixtures/v2.json";
import { V2_STORAGE_KEY, V5_STORAGE_KEY } from "../storage/app-store";

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

  it("defaults to light and makes appearance settings interactive", async () => {
    render(<HabitApp initialView="settings" />);
    const colourMode = await screen.findByRole("button", { name: /Colour mode/ });
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(colourMode);
    const dark = screen.getByRole("button", { name: "Dark" });
    fireEvent.click(dark);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(dark.getAttribute("aria-pressed")).toBe("true");
  });

  it("opens settings rows and persists their controls", async () => {
    render(<HabitApp initialView="settings" />);
    const calendar = await screen.findByRole("button", { name: /Date & calendar/ });
    fireEvent.click(calendar);
    expect(screen.getByLabelText("Time zone")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Week starts on"), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: /Date & calendar/ }).textContent).toContain("Monday");

    fireEvent.click(screen.getByRole("button", { name: /Successful day rule/ }));
    expect(screen.getByLabelText("Successful day rule")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Daily journal reminder/ }));
    const reminder = screen.getByRole("checkbox", { name: /Reminder enabled/ });
    fireEvent.click(reminder);
    expect(screen.getByText("Reminder disabled")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Microphone & photos/ }));
    expect(screen.getByRole("button", { name: "Test microphone" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Notification permission/ }));
    expect(screen.getByRole("button", { name: "Request notification permission" })).toBeTruthy();
  });

  it("reorders routines and persists the new dashboard order", async () => {
    render(<HabitApp initialView="routines" />);
    const moveMorningUp = await screen.findByRole("button", { name: "Move Morning routine up" });
    const moveEveningUp = screen.getByRole("button", { name: "Move Evening routine up" });
    expect(moveMorningUp.hasAttribute("disabled")).toBe(true);

    fireEvent.click(moveEveningUp);
    expect(screen.getByRole("button", { name: "Move Evening routine up" }).hasAttribute("disabled")).toBe(true);

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(V5_STORAGE_KEY) ?? "null");
      const active = saved.routines.filter((routine: { archivedAt?: string }) => !routine.archivedAt).sort((left: { sortOrder: number }, right: { sortOrder: number }) => left.sortOrder - right.sortOrder);
      expect(active.map((routine: { name: string }) => routine.name).slice(0, 2)).toEqual(["Evening routine", "Morning routine"]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    const eveningCard = await screen.findByRole("button", { name: "Open Evening routine details" });
    const morningCard = screen.getByRole("button", { name: "Open Morning routine details" });
    expect(eveningCard.compareDocumentPosition(morningCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reorders routine steps and saves their order", async () => {
    render(<HabitApp initialView="routines" />);
    const morningName = await screen.findByText("Morning routine");
    fireEvent.click(morningName.closest("button")!);
    fireEvent.click(await screen.findByRole("button", { name: "Edit routine" }));

    const moveSupplementsUp = await screen.findByRole("button", { name: "Move Take supplements up" });
    fireEvent.click(moveSupplementsUp);
    expect((screen.getByLabelText("Step 1") as HTMLInputElement).value).toBe("Take supplements");
    expect((screen.getByLabelText("Step 2") as HTMLInputElement).value).toBe("Review today’s priorities");
    fireEvent.click(screen.getByRole("button", { name: "Save routine" }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(V5_STORAGE_KEY) ?? "null");
      const routine = saved.routines.find((value: { name: string }) => value.name === "Morning routine");
      expect(routine.tasks.map((task: { label: string; order: number }) => [task.label, task.order])).toEqual([
        ["Take supplements", 0],
        ["Review today’s priorities", 1],
      ]);
    });
  });
});
