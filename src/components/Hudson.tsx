export function Hudson({
  theater,
  line,
  onClose,
  onNext,
}: {
  theater: string;
  line: string;
  onClose: () => void;
  onNext: (() => void) | null;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/75 p-4 md:items-center">
      <div className="grid w-full max-w-3xl gap-4 border border-line bg-surface p-4 md:grid-cols-[180px_1fr]">
        <img src="/media/hudson.jpg" alt="Major Hudson" className="h-56 w-full object-cover md:h-full" />
        <div>
          <p className="font-display text-xs tracking-[0.22em] text-gold">MAJOR HUDSON · BETWEEN CHAPTERS</p>
          <h2 className="font-display text-3xl">{theater}</h2>
          <p className="mt-3 text-base text-fg">{line}</p>
          <p className="mt-2 text-sm text-muted">The next brief stays sealed until this film is watched to the end, or this ground is held.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {onNext && (
              <button type="button" onClick={onNext} className="min-h-11 bg-ion px-4 font-display text-bg">
                Next brief
              </button>
            )}
            <button type="button" onClick={onClose} className="min-h-11 border border-line px-4 font-display">
              Chapter list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
