export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <main id="main-content" className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-display text-4xl font-black tracking-wide text-accent drop-shadow-[0_0_12px_var(--accent)]">
            ⚔ Life RPG
          </p>
          <p className="mt-2 text-sm text-parchment-dim">
            Your life is the greatest campaign you will ever play.
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
