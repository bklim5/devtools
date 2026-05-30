// Throwaway Phase-1 placeholder rendering the dark window (FND-01). Plan 02
// ports the real router/App; this just proves the --win/--bg-app chrome + the
// vendored IBM Plex Sans font render in the real WKWebView.
function App() {
  return (
    <main className="flex min-h-screen items-center justify-center font-sans text-[#e7e9ee]">
      <div className="rounded-lg border border-white/10 bg-win px-8 py-6 shadow-2xl">
        <h1 className="text-xl font-semibold">DevTools — scaffold</h1>
        <p className="mt-1 text-sm text-white/60">
          Phase 1 walking skeleton lands in the next plan.
        </p>
      </div>
    </main>
  );
}

export default App;
