"use client";

import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";

/**
 * Entrée d'écran homogène (B4) : fondu + léger glissement, 200 ms ease-out,
 * rejouée à chaque changement de chemin (key) mais pas au changement de
 * paramètres de recherche (filtres). `prefers-reduced-motion` respecté via
 * MotionConfig.
 */
export function EntreeAnimee({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={pathname}
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
