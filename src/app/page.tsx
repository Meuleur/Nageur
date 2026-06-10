"use client";

import { motion, MotionConfig, type Variants } from "framer-motion";
import { Check, Clock, Loader2, Pencil, Waves, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_BADGES = [
  { variant: "pending", label: "En attente", icon: Clock },
  { variant: "valid", label: "Validée", icon: Check },
  { variant: "modified", label: "Modifiée par le coach", icon: Pencil },
  { variant: "refused", label: "Refusée", icon: X },
] as const;

// Static showcase content — no business logic in CH0.
const DEMO_CARDS = [
  {
    title: "Séance du mardi",
    description: "Endurance · 2 000 m · 45 min",
    body: "Échauffement 400 m, 8 × 100 m crawl départ 2'00, retour au calme 200 m.",
    status: STATUS_BADGES[0],
  },
  {
    title: "Séance du jeudi",
    description: "Technique · 1 500 m · 40 min",
    body: "Éducatifs battements, 6 × 50 m rattrapé, 4 × 100 m nage complète.",
    status: STATUS_BADGES[1],
  },
  {
    title: "Séance du samedi",
    description: "Vitesse · 1 800 m · 50 min",
    body: "Sprints 12 × 25 m départ plot, récupération active 100 m entre les blocs.",
    status: STATUS_BADGES[2],
  },
] as const;

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      <p className="text-caption text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function DesignSystemDemoPage() {
  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-12"
        >
          {/* En-tête */}
          <motion.header variants={sectionVariants} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary-hover">
                <Waves className="size-6" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">App Natation</h1>
                <p className="text-caption text-muted-foreground">
                  Chantier CH0 — Fondations · Démonstration de la charte (B4)
                </p>
              </div>
            </div>
            <p className="max-w-2xl text-[15px] text-muted-foreground">
              Cette page valide l&apos;application du système de design&nbsp;: palette, typographie
              Inter, badges de statut, boutons, cartes et micro-animations. Elle ne contient aucune
              logique métier.
            </p>
          </motion.header>

          {/* Boutons */}
          <motion.section variants={sectionVariants} className="space-y-4">
            <SectionTitle
              title="Boutons"
              hint="Primaire plein · secondaire contour · tertiaire texte · états désactivé et chargement"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button>Générer une séance</Button>
              <Button variant="outline">Annuler</Button>
              <Button variant="ghost">Voir le détail</Button>
              <Button variant="secondary">Action douce</Button>
              <Button disabled>Désactivé</Button>
              <Button disabled>
                <Loader2 className="animate-spin" aria-hidden />
                Génération…
              </Button>
            </div>
          </motion.section>

          {/* Badges de statut */}
          <motion.section variants={sectionVariants} className="space-y-4">
            <SectionTitle
              title="Statuts de séance"
              hint="Couleur + icône + libellé : le statut n'est jamais porté par la seule couleur"
            />
            <div className="flex flex-wrap items-center gap-3">
              {STATUS_BADGES.map(({ variant, label, icon: Icon }) => (
                <Badge key={variant} variant={variant}>
                  <Icon aria-hidden />
                  {label}
                </Badge>
              ))}
            </div>
          </motion.section>

          {/* Cartes */}
          <motion.section variants={sectionVariants} className="space-y-4">
            <SectionTitle
              title="Cartes de séance"
              hint="Surface blanche, rayon 16 px, élévation légère au survol, apparition en fondu + glissement"
            />
            <motion.div
              variants={listVariants}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {DEMO_CARDS.map(({ title, description, body, status }) => (
                <motion.div key={title} variants={sectionVariants}>
                  <Card className="h-full transition-shadow duration-200 hover:shadow-md">
                    <CardHeader>
                      <CardTitle>{title}</CardTitle>
                      <CardDescription>{description}</CardDescription>
                      <CardAction>
                        <Badge variant={status.variant}>
                          <status.icon aria-hidden />
                          {status.label}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[15px] leading-relaxed text-muted-foreground">{body}</p>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        Détail
                      </Button>
                      <Button variant="secondary" size="sm">
                        Ouvrir la séance
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Typographie */}
          <motion.section variants={sectionVariants} className="space-y-4">
            <SectionTitle
              title="Typographie"
              hint="Inter — échelle B4 (titre 24–28, sous-titre 18–20, corps 15–16, légende 13)"
            />
            <Card>
              <CardContent className="space-y-3">
                <p className="text-[28px] font-semibold leading-9">
                  Titre d&apos;écran — semibold 28
                </p>
                <p className="text-lg font-semibold">Sous-titre — semibold 18</p>
                <p className="text-base">
                  Corps de texte — regular 16. La séance générée est relue puis validée par le coach
                  avant d&apos;être visible par le nageur.
                </p>
                <p className="text-caption text-muted-foreground">
                  Légende / méta — regular 13, couleur atténuée.
                </p>
              </CardContent>
            </Card>
          </motion.section>

          <motion.footer variants={sectionVariants}>
            <p className="text-caption text-muted-foreground">
              Page de démonstration de la charte — aucune logique métier (chantier CH0).
            </p>
          </motion.footer>
        </motion.div>
      </main>
    </MotionConfig>
  );
}
