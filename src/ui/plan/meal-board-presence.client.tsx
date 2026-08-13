"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function MealBoardSlotPresence({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.li
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      className="min-w-0"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
    >
      {children}
    </motion.li>
  );
}
