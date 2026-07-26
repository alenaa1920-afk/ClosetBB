"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/domain/format";
import { supabaseBrowser } from "@/lib/supabase/client";

type Method = "password" | "link";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const linkError = params.get("error");

  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    const client = supabaseBrowser();
    if (!client) {
      toast.error("This Mon Amour has no Supabase keys configured");
      return;
    }

    setBusy(true);
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "That email and password don't match"
          : error.message,
      );
      return;
    }

    // A full navigation, so the middleware sees the new session cookie.
    const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.replace(destination);
    router.refresh();
  }

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const client = supabaseBrowser();
    if (!client) {
      toast.error("This Mon Amour has no Supabase keys configured");
      return;
    }

    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);

    if (error) {
      toast.error(error.message, {
        description: error.message.toLowerCase().includes("rate")
          ? "Supabase's free mailer allows only a couple an hour. Use a password instead."
          : undefined,
      });
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <motion.div
        className="glass rounded-lg p-8 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-petal/60">
          <Sparkles className="h-5 w-5 text-accent" strokeWidth={1.6} />
        </span>
        <h2 className="font-display text-2xl text-ink">Check your inbox</h2>
        <p className="mt-3 text-[0.88rem] leading-relaxed text-muted">
          A sign-in link is on its way to{" "}
          <span className="text-ink">{email.trim()}</span>. It opens the wardrobe
          straight away.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-6 text-[0.8rem] text-accent underline underline-offset-4"
        >
          Use a password instead
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="glass rounded-lg p-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {linkError ? (
        <p className="mb-5 rounded-sm border border-accent/25 bg-petal/40 px-4 py-3 text-[0.82rem] text-ink">
          {linkError === "expired"
            ? "That link had already been used. Sign in with your password."
            : "Something interrupted the sign-in. Try again."}
        </p>
      ) : null}

      <form onSubmit={method === "password" ? signInWithPassword : sendLink}>
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-autofocus
          />
        </Field>

        <AnimatePresence initial={false} mode="wait">
          {method === "password" ? (
            <motion.div
              key="password"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="pt-5">
                <Field label="Password">
                  <Input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button
          type="submit"
          size="lg"
          className="mt-6 w-full"
          disabled={busy || !email.trim() || (method === "password" && !password)}
        >
          {method === "password" ? (
            <>
              <KeyRound className="h-4 w-4" strokeWidth={1.8} />
              {busy ? "Opening…" : "Enter"}
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" strokeWidth={1.8} />
              {busy ? "Sending…" : "Send me the link"}
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line-warm" />
        <span className="text-[0.68rem] tracking-[0.18em] text-muted uppercase">
          or
        </span>
        <span className="h-px flex-1 bg-line-warm" />
      </div>

      <button
        type="button"
        onClick={() => setMethod(method === "password" ? "link" : "password")}
        className={cn(
          "mt-5 w-full rounded-full border border-line bg-card/50 py-2.5",
          "text-[0.82rem] text-muted transition-colors duration-400",
          "hover:bg-petal/45 hover:text-ink",
        )}
      >
        {method === "password"
          ? "Email me a sign-in link instead"
          : "Sign in with a password instead"}
      </button>

      <p className="mt-5 text-center text-[0.74rem] leading-relaxed text-muted/80">
        Signing in once is enough — this stays open for good.
      </p>
    </motion.div>
  );
}
