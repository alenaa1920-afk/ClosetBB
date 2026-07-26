"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";
import { Particles } from "./particles";

/** She sees the greeting for exactly this long, every single visit. */
const HOLD_MS = 3000;
/** Length of the veil lift, kept in sync with the transitions below. */
const LIFT_MS = 1100;

type Phase = "greeting" | "lifting" | "settled";

/**
 * Wraps the whole app. On every load the greeting holds the screen for three
 * seconds, then lifts away like a veil. There is deliberately no skip button.
 */
export function WelcomeGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("greeting");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const lift = setTimeout(() => setPhase("lifting"), HOLD_MS);
    const settle = setTimeout(() => setPhase("settled"), HOLD_MS + LIFT_MS);
    return () => {
      clearTimeout(lift);
      clearTimeout(settle);
    };
  }, []);

  // Hold the page still while the greeting is up.
  useEffect(() => {
    if (phase === "settled") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  const veiled = mounted && phase === "greeting";

  /**
   * Once settled the wrapper carries no transform or filter at all — those
   * would otherwise become the containing block for the app's fixed sheets.
   */
  const wrapperStyle: CSSProperties | undefined =
    phase === "settled"
      ? undefined
      : {
          opacity: veiled ? 0.5 : 1,
          transform: veiled ? "scale(1.035)" : "scale(1)",
          filter: veiled ? "blur(10px)" : "blur(0px)",
          transition: `opacity ${LIFT_MS}ms var(--ease-silk), transform ${LIFT_MS}ms var(--ease-silk), filter ${LIFT_MS}ms var(--ease-silk)`,
        };

  return (
    <>
      <div style={wrapperStyle}>{children}</div>
      <AnimatePresence>
        {phase === "greeting" ? <Greeting /> : null}
      </AnimatePresence>
    </>
  );
}

function Greeting() {
  const reduced = useReducedMotion();

  // Each word arrives on its own, then the heart, then the gold rule.
  const word = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 22, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 1.15, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <motion.div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-hidden bg-blush"
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: reduced ? 1 : 1.05,
        filter: reduced ? "blur(0px)" : "blur(14px)",
      }}
      transition={{ duration: LIFT_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
      aria-live="polite"
    >
      {/* Light in the room */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46rem 30rem at 50% 42%, rgba(251,207,232,.72), transparent 66%), radial-gradient(30rem 22rem at 78% 78%, rgba(230,196,106,.18), transparent 64%), radial-gradient(34rem 26rem at 18% 74%, rgba(244,114,182,.22), transparent 66%)",
        }}
      />

      <Particles count={26} />

      {/* A breathing bloom behind the words */}
      <motion.div
        aria-hidden
        className="absolute h-[34rem] w-[34rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(244,114,182,.24), transparent 62%)",
          filter: "blur(30px)",
        }}
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.94, 1.04, 0.94] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        <h1 className="flex flex-wrap items-center justify-center gap-x-[0.3em] gap-y-2 font-display text-[clamp(2.6rem,10vw,7rem)] leading-[1.04] font-normal tracking-[-0.02em] text-ink">
          <motion.span {...word(0.15)}>Bonjour</motion.span>

          <motion.span
            className="relative inline-flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 1,
              delay: 0.75,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          >
            <span
              aria-hidden
              className="absolute h-[1.6em] w-[1.6em] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(244,114,182,.42), transparent 64%)",
                filter: "blur(12px)",
              }}
            />
            <motion.span
              className="relative inline-flex"
              animate={reduced ? undefined : { scale: [1, 1.13, 1] }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.6,
              }}
            >
              <Heart
                aria-label="love"
                className="h-[0.62em] w-[0.62em] text-primary"
                style={{
                  fill: "var(--color-primary)",
                  filter: "drop-shadow(0 6px 18px rgba(236,72,153,.42))",
                }}
                strokeWidth={1}
              />
            </motion.span>
          </motion.span>

          <motion.span {...word(1.15)}>Madame</motion.span>
        </h1>

        {/* A fine gold rule that draws itself open */}
        <motion.div
          aria-hidden
          className="mt-8 h-px w-40 rule-gold"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 1.4, delay: 1.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </motion.div>
  );
}
