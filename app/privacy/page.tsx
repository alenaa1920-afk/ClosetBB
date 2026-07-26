import Link from "next/link";

export const metadata = {
  title: "Mon Amour — Privacy",
  description: "What Mon Amour stores, and what it never does.",
};

/**
 * Required by the Chrome Web Store: any extension handling personal or
 * authentication data must link to a privacy policy at a public URL.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link
        href="/"
        className="mb-12 inline-block text-[0.82rem] text-muted transition-colors hover:text-ink"
      >
        ← Mon Amour
      </Link>

      <p className="mb-3 text-[0.66rem] font-medium tracking-[0.3em] text-accent uppercase">
        Privacy
      </p>
      <h1 className="font-display text-[2.4rem] leading-tight tracking-[-0.02em] text-ink">
        What this keeps, and what it never touches
      </h1>
      <div aria-hidden className="mt-8 h-px w-24 rule-gold" />

      <div className="mt-12 space-y-10 text-[0.92rem] leading-relaxed text-muted">
        <section>
          <h2 className="mb-3 font-display text-[1.3rem] text-ink">
            This is a private wardrobe
          </h2>
          <p>
            Mon Amour is a personal tool, not a service. It is run by one person for
            one person. Nothing is sold, shared, syndicated, or handed to anybody,
            because there is nobody to hand it to.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-[1.3rem] text-ink">
            What is stored
          </h2>
          <ul className="space-y-2.5">
            <li>
              <span className="text-ink">Your email address</span>, so you can sign
              in. Held by Supabase, the database this runs on.
            </li>
            <li>
              <span className="text-ink">The pieces you save</span> — name, brand,
              shop, price, photograph, link, size, colour, quantity and the notes
              you write.
            </li>
            <li>
              <span className="text-ink">Price history</span> for those pieces, so a
              drop can be pointed out.
            </li>
          </ul>
          <p className="mt-4">
            All of it sits behind row-level security, meaning the database itself
            refuses to return one person&rsquo;s wardrobe to anyone else, regardless
            of what the application asks for.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-[1.3rem] text-ink">
            What the extension does
          </h2>
          <p>
            The Chrome extension reads the page you are looking at on supported
            shops — Myntra, Zara, H&amp;M, Ajio, Nykaa, Urbanic, Savana — to pull
            out the piece you just added to your bag. It reads only product details:
            name, price, photograph, size, colour.
          </p>
          <p className="mt-4">It never reads, stores, or transmits:</p>
          <ul className="mt-2.5 space-y-2">
            <li>passwords or logins for any shop</li>
            <li>payment card or banking details</li>
            <li>addresses, orders, or order history</li>
            <li>anything at all on any site not listed above</li>
          </ul>
          <p className="mt-4">
            It holds one authentication token for Mon Amour itself, stored locally
            in your own browser so you do not have to sign in twice. It is sent to
            nowhere except this site.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-[1.3rem] text-ink">No tracking</h2>
          <p>
            There are no analytics, no advertising, no cookies beyond the one that
            keeps you signed in, and no third-party scripts. Nothing follows you
            anywhere.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-[1.3rem] text-ink">
            Removing it all
          </h2>
          <p>
            Delete any piece from its detail sheet and it is gone. To remove
            everything, ask the person who runs this to delete your account — the
            database removes every piece, collection and price record along with it,
            automatically.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-[1.3rem] text-ink">
            Where it lives
          </h2>
          <p>
            The site runs on Vercel. The database and sign-in are Supabase. Product
            photographs are loaded directly from the shop they came from, so those
            shops can see that an image was requested — the same as browsing their
            site normally.
          </p>
        </section>
      </div>
    </main>
  );
}
