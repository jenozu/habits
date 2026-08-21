import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { JournalComposer } from "../components/journal-composer";
import { useMediaRecorder } from "../hooks/use-media-recorder";

class MockRecorder {
  static isTypeSupported = vi.fn(() => true);
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn(() => { this.state = "recording"; });
  stop = vi.fn(() => { this.state = "inactive"; this.onstop?.(); });
}

describe("microphone and object URL cleanup", () => {
  const track = { stop: vi.fn() };
  beforeEach(() => {
    track.stop.mockClear();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) } });
    Object.assign(globalThis, { MediaRecorder: MockRecorder });
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("stops MediaRecorder and every microphone track on unmount", async () => {
    const { result, unmount } = renderHook(() => useMediaRecorder(vi.fn()));
    await act(async () => { await result.current.start(); });
    expect(result.current.recording).toBe(true);
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it("revokes a preview URL when an attachment is removed", () => {
    render(<JournalComposer date="2026-08-21" onClose={vi.fn()} onSave={vi.fn()} />);
    const input = screen.getByLabelText(/Add photos/i);
    fireEvent.change(input, { target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove photo.jpg" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("revokes abandoned previews when the composer unmounts", () => {
    const view = render(<JournalComposer date="2026-08-21" onClose={vi.fn()} onSave={vi.fn()} />);
    const input = screen.getByLabelText(/Add photos/i);
    fireEvent.change(input, { target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] } });
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
});
