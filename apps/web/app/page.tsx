import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container pb-16">
      <section className="grid gap-10 py-12 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <p className="mb-3 inline-block rounded-full bg-[#ece7d7] px-3 py-1 text-xs uppercase tracking-wider">
            Beacon MVP
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Turn your best LLM rabbit holes into Beacons.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-neutral-700">
            Preserve your inquiry, open it to matching, and discover who else is exploring the same thing or can help move it forward.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-full bg-[var(--accent)] px-5 py-2 font-medium text-white">
              Try Beacon
            </Link>
            <a
              href="mailto:founders@usebeacon.ai?subject=Beacon%20Waitlist"
              className="rounded-full border border-neutral-300 px-5 py-2 font-medium"
            >
              Join waitlist
            </a>
          </div>
        </div>
        <div className="card p-5">
          <p className="text-sm text-neutral-600">Magic moment</p>
          <p className="mt-2 text-lg font-medium">@Beacon this</p>
          <p className="mt-3 text-sm text-neutral-700">
            One action from LLM conversation to a structured inquiry card and top related matches.
          </p>
        </div>
      </section>
    </main>
  );
}
