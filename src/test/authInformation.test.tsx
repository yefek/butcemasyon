import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInformation } from "@/budget/components/AuthInformation";

describe("desktop information carousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("cycles through all three cards every seven seconds and wraps", () => {
    render(<AuthInformation />);
    expect(screen.getByText("Bütçeni tek bakışta gör.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6999));
    expect(screen.getByText("Bütçeni tek bakışta gör.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Kayıtlarını kolayca yönet.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByText("Ayını daha bilinçli kapat.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByText("Bütçeni tek bakışta gör.")).toBeInTheDocument();
  });

  it("pauses for reading, supports manual selection, and resumes when requested", () => {
    render(<AuthInformation />);
    fireEvent.mouseEnter(screen.getByLabelText("Bütçemasyon tanıtımı"));
    act(() => vi.advanceTimersByTime(14000));
    expect(screen.getByText("Bütçeni tek bakışta gör.")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByLabelText("Bütçemasyon tanıtımı"));
    fireEvent.click(screen.getByLabelText("Otomatik geçişi duraklat"));
    fireEvent.click(screen.getByLabelText("3. bilgi kartı"));
    act(() => vi.advanceTimersByTime(14000));
    expect(screen.getByText("Ayını daha bilinçli kapat.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Otomatik geçişi başlat"));
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByText("Bütçeni tek bakışta gör.")).toBeInTheDocument();
  });

  it("does not rotate the hidden carousel on mobile", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    render(<AuthInformation />);
    act(() => vi.advanceTimersByTime(14000));
    expect(screen.getByText("Bütçeni tek bakışta gör.")).toBeInTheDocument();
  });
});
