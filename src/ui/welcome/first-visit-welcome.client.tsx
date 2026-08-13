"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WELCOME_DISMISSED_KEY = "household-os:welcome-dismissed";
const WELCOME_DISMISSED_VALUE = "1";

type WelcomePhase = "pending" | "showing" | "dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) === WELCOME_DISMISSED_VALUE;
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(WELCOME_DISMISSED_KEY, WELCOME_DISMISSED_VALUE);
  } catch {
    // Ignore quota / privacy-mode failures; in-memory dismiss still applies.
  }
}

export function FirstVisitWelcome() {
  const [phase, setPhase] = useState<WelcomePhase>("pending");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setPhase(readDismissed() ? "dismissed" : "showing");
  }, []);

  function dismiss(): void {
    persistDismissed();
    setPhase("dismissed");
  }

  switch (phase) {
    case "pending":
      return null;
    case "dismissed":
      return null;
    case "showing":
      return (
        <AnimatePresence>
          <motion.div
            aria-labelledby="first-visit-welcome-title"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
            exit={reduceMotion ? undefined : { opacity: 0 }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            key="welcome-overlay"
            role="dialog"
            transition={{ duration: 0.2 }}
          >
            <motion.div
              animate={
                reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }
              }
              className="w-full max-w-md"
              exit={
                reduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 8 }
              }
              initial={
                reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }
              }
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle id="first-visit-welcome-title">
                    Welcome to your household
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <p className="text-sm text-muted-foreground">
                    Plan meals, share groceries, keep routines moving, and
                    settle money in one place—both of you, equally.
                  </p>
                  <Button onClick={dismiss} size="lg" type="button">
                    Got it
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      );
    default: {
      const exhaustivePhase: never = phase;
      return exhaustivePhase;
    }
  }
}
