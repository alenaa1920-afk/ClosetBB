import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { Particles } from "@/components/welcome/particles";
import { HeartsLoader } from "@/components/ui/hearts-loader";

export const metadata = { title: "Mon Amour — Entrée" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-16">
      <Particles count={18} seed={7} />

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="mb-4 text-[0.68rem] font-medium tracking-[0.34em] text-accent uppercase">
            Mon Amour
          </p>
          <h1 className="font-display text-[2.6rem] leading-[1.1] tracking-[-0.02em] text-ink">
            Her wardrobe,
            <br />
            <span className="italic">all in one place</span>
          </h1>
          <div aria-hidden className="mx-auto mt-7 h-px w-24 rule-gold" />
        </div>

        <Suspense fallback={<HeartsLoader label="One moment" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
