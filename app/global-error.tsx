"use client";

// Shown only when the root layout itself fails (for example the database does not answer while the session is read). It
// replaces the whole document, so it has no menu, theme or stylesheet: plain browser text, which stays readable in any theme.
// No inline styles either (the page policy refuses them).
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <main>
          <h1>Divination Station could not be shown</h1>
          <p role="alert">Something went wrong on the server. What you saved before is kept. Try again in a moment.</p>
          <p>
            <button type="button" onClick={() => retry()}>Try again</button>
          </p>
        </main>
      </body>
    </html>
  );
}
