import Image from 'next/image';
import Link from 'next/link';

const problemPoints = [
  'LLMs help you explore ideas deeply, but those explorations usually die in private threads.',
  'Posting to social media is noisy, performative, and depends on follower graphs.',
  'The people who could actually help are usually invisible when you need them.'
];

const solutionSteps = [
  {
    title: 'Explore',
    description: 'Go deep on an idea in your LLM of choice.'
  },
  {
    title: 'Beacon it',
    description: 'Turn the conversation into a clean, structured Beacon.'
  },
  {
    title: 'Discover',
    description: 'See who else is on the same question or who has the missing perspective.'
  }
];

const differences = [
  {
    title: 'Better than chat history',
    description: 'Your ideas become reusable objects, not buried threads.'
  },
  {
    title: 'Better than posting',
    description: 'You do not need followers to reach the right people.'
  },
  {
    title: 'Better than search',
    description: 'Beacon helps you find the right minds, not just the right links.'
  }
];

const useCases = [
  {
    title: 'Founders',
    description: 'Pressure-test startup ideas and find people with adjacent insight.'
  },
  {
    title: 'Researchers',
    description: 'Discover others exploring similar questions or missing methods.'
  },
  {
    title: 'Engineers',
    description: 'Find people working through the same technical rabbit holes.'
  },
  {
    title: 'Curious minds',
    description: 'Turn interesting explorations into meaningful connections.'
  }
];

const faqs = [
  {
    question: 'Is Beacon another chatbot?',
    answer:
      'No. Beacon sits on top of your existing LLM workflow and helps you act on the best ideas that come out of it.'
  },
  {
    question: 'Do I need a big audience?',
    answer: 'No. Beacon is designed to help you find relevant people even if you have zero followers.'
  },
  {
    question: 'Does Beacon share all my chats?',
    answer: 'No. Only the conversations you explicitly Beacon are turned into inquiry objects.'
  },
  {
    question: 'Who is this for?',
    answer:
      'People who use LLMs as thought partners: founders, researchers, engineers, and curious power users.'
  }
];

export default function HomePage() {
  return (
    <main className="landing container pb-20 md:pb-28">
      <section className="grid gap-7 pt-6 md:grid-cols-[1.08fr_1fr] md:items-center md:gap-10 md:pt-10">
        <div className="space-y-5 md:space-y-6">
          <h1 className="max-w-3xl text-[clamp(2.05rem,8.8vw,4.7rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
            Turn your LLM rabbit holes into connections
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[color:var(--ink-muted)] md:text-[1.18rem]">
            Had an interesting exploration with ChatGPT or Claude? Beacon it, then discover who else is thinking about
            the same thing or who can help move it forward.
          </p>
          <div className="hero-cta flex flex-wrap gap-2.5 md:gap-3">
            <Link href="/login" className="button-primary">
              Try now
            </Link>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            >
              How it works
            </a>
          </div>
        </div>

        <Image
          src="/meme.jpg"
          alt="Spider-Man meme showing two people pointing at each other"
          width={1200}
          height={900}
          className="h-auto w-full rounded-[20px] object-cover"
          priority
        />
      </section>

      <section className="space-y-4 md:space-y-5" id="problem">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
          Your best ideas are getting trapped in chat history
        </h2>
        <ul className="space-y-3 text-[color:var(--ink-muted)]">
          {problemPoints.map((point) => (
            <li key={point} className="card p-4 leading-relaxed md:p-5">
              {point}
            </li>
          ))}
        </ul>
        <p className="text-base text-[color:var(--ink)]">
          LLMs understand what you are exploring. The internet still does not know what to do with that.
        </p>
      </section>

      <section className="space-y-4 md:space-y-5" id="solution">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
          Beacon turns live inquiry into discovery
        </h2>
        <p className="max-w-3xl text-[color:var(--ink-muted)]">
          When you have a valuable conversation with your LLM, Beacon turns it into a structured inquiry you can save,
          revisit, and optionally open up to matching.
        </p>
        <div className="grid gap-3.5 md:grid-cols-3 md:gap-5">
          {solutionSteps.map((step, index) => (
            <article key={step.title} className="card p-5 md:p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
                Step {index + 1}
              </p>
              <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4 md:space-y-5">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
          A new primitive for the LLM era
        </h2>
        <div className="grid gap-3.5 md:grid-cols-3 md:gap-5">
          <article className="card p-5 md:p-6">
            <h3 className="mb-2 text-xl font-semibold">Beacon Card</h3>
            <p className="text-sm text-[color:var(--ink-muted)]">
              Title, summary, what you are exploring, and what help you want.
            </p>
          </article>
          <article className="card p-5 md:p-6">
            <h3 className="mb-2 text-xl font-semibold">Related Thinkers</h3>
            <p className="text-sm text-[color:var(--ink-muted)]">
              Find people on the same topic and people with useful adjacent expertise.
            </p>
          </article>
          <article className="card p-5 md:p-6">
            <h3 className="mb-2 text-xl font-semibold">Intro Prompt</h3>
            <p className="text-sm text-[color:var(--ink-muted)]">
              A lightweight way to connect around inquiry without broadcasting to a feed.
            </p>
          </article>
        </div>
        <p className="text-[color:var(--ink)]">
          Not a feed. Not another social network. Just high-signal discovery around ideas that matter.
        </p>
      </section>

      <section className="space-y-4 md:space-y-5">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
          Why this is different
        </h2>
        <div className="grid gap-3.5 md:grid-cols-3 md:gap-5">
          {differences.map((item) => (
            <article key={item.title} className="card p-5 md:p-6">
              <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
              <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4 md:space-y-5">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
          For people who think with LLMs
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
          {useCases.map((item) => (
            <article key={item.title} className="card p-5 md:p-6">
              <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
              <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5 md:space-y-5 md:p-9">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
          A missing social primitive
        </h2>
        <p className="max-w-3xl leading-relaxed text-[color:var(--ink-muted)]">
          For the first time, software understands what you are actively trying to figure out. Beacon is built around
          that moment: not who you are in general, but what you are exploring right now.
        </p>
        <p className="text-lg font-medium">
          The future is not just AI that helps us think. It is AI that helps the right people find each other.
        </p>
      </section>

      <section className="space-y-4 md:space-y-5" id="how-it-works">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">How Beacon works</h2>
        <ol className="grid gap-3.5 md:grid-cols-4 md:gap-5">
          <li className="card p-5 text-sm leading-relaxed text-[color:var(--ink-muted)] md:p-6">
            1. Have an interesting conversation with your LLM
          </li>
          <li className="card p-5 text-sm leading-relaxed text-[color:var(--ink-muted)] md:p-6">2. Click "Beacon this"</li>
          <li className="card p-5 text-sm leading-relaxed text-[color:var(--ink-muted)] md:p-6">
            3. Review the generated inquiry
          </li>
          <li className="card p-5 text-sm leading-relaxed text-[color:var(--ink-muted)] md:p-6">
            4. See who else is thinking about it
          </li>
        </ol>
        <p className="text-sm text-[color:var(--ink-muted)]">Private by default. Social only when you choose.</p>
      </section>

      <section className="space-y-4 md:space-y-5" id="faq">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">FAQ</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <article key={faq.question} className="card p-5 md:p-6">
              <h3 className="mb-2 text-lg font-semibold">{faq.question}</h3>
              <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5 md:space-y-5 md:p-9">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
          Your next great conversation might already be out there
        </h2>
        <p className="max-w-3xl leading-relaxed text-[color:var(--ink-muted)]">
          Turn your best LLM explorations into Beacons and discover who else is thinking about the same thing.
        </p>
        <div className="hero-cta flex flex-wrap gap-3">
          <Link href="/login" className="button-primary">
            Try now
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-grid">
          <div>
            <p className="text-base font-semibold text-[color:var(--ink)]">Beacon</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[color:var(--ink-muted)]">
              Turn live inquiry into connection.
            </p>
          </div>
          <div className="footer-links">
            <a href="#solution">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
            <a href="mailto:founders@usebeacon.ai">Contact</a>
            <a href="https://x.com" target="_blank" rel="noreferrer">
              X / socials
            </a>
            <Link href="/">Privacy</Link>
            <Link href="/">Terms</Link>
          </div>
        </div>
        <p className="footer-meta">Beacon</p>
      </footer>
    </main>
  );
}
