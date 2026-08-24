import { act, renderHook } from "@testing-library/react";
import { useDictation, type SpeechRecognitionLike } from "../hooks/use-dictation";

class MockRecognition implements SpeechRecognitionLike {
  static instances: MockRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  onresult: SpeechRecognitionLike["onresult"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  constructor() { MockRecognition.instances.push(this); }
}

describe("dictation lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockRecognition.instances = [];
    Object.assign(window, { webkitSpeechRecognition: MockRecognition });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("uses the same control to start and stop dictation", () => {
    const { result } = renderHook(() => useDictation(vi.fn()));
    act(() => result.current.toggle());
    expect(result.current.listening).toBe(true);
    act(() => result.current.toggle());
    expect(MockRecognition.instances[0].stop).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(false);
  });

  it("stops through the live recognition ref at the time limit", () => {
    const { result } = renderHook(() => useDictation(vi.fn(), 60_000));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockRecognition.instances[0].stop).toHaveBeenCalledTimes(1);
  });

  it("stops recognition and clears its timer on unmount", () => {
    const { result, unmount } = renderHook(() => useDictation(vi.fn()));
    act(() => result.current.start());
    unmount();
    expect(MockRecognition.instances[0].stop).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockRecognition.instances[0].stop).toHaveBeenCalledTimes(1);
  });
});
