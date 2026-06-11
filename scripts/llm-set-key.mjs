#!/usr/bin/env node
/**
 * Injection d'une clé API LLM en dev/test (CH4) — tant que l'UI Super Admin
 * (CH8) n'existe pas. Passe par la fonction SQL set_llm_api_key (Vault,
 * ADR-007) via PostgREST en service role : la clé est chiffrée en base,
 * jamais stockée en clair, jamais affichée par ce script.
 *
 * Usage :
 *   pnpm llm:set-key <openai|anthropic> [cle] [--model <modele>] [--activate]
 *
 * La clé peut aussi être fournie via la variable d'environnement LLM_API_KEY
 * (évite l'historique du shell). Lit NEXT_PUBLIC_SUPABASE_URL et
 * SUPABASE_SERVICE_ROLE_KEY depuis l'environnement ou .env.local.
 */

import { readFileSync } from "node:fs";

function chargerEnvLocal() {
  try {
    for (const ligne of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const correspondance = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
      if (!correspondance) continue;
      const [, nom, brut] = correspondance;
      if (process.env[nom] !== undefined) continue;
      process.env[nom] = brut.replace(/^["']|["']$/g, "");
    }
  } catch {
    // pas de .env.local : on s'appuie sur l'environnement
  }
}

function usage(message) {
  console.error(`Erreur : ${message}`);
  console.error(
    "Usage : pnpm llm:set-key <openai|anthropic> [cle] [--model <modele>] [--activate]",
  );
  process.exit(1);
}

chargerEnvLocal();

const args = process.argv.slice(2);
const fournisseur = args[0];
if (!["openai", "anthropic"].includes(fournisseur ?? "")) {
  usage("fournisseur attendu : openai ou anthropic");
}

let cle = process.env.LLM_API_KEY ?? "";
let modele = null;
let activer = false;
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--model") modele = args[++i] ?? usage("--model attend une valeur");
  else if (args[i] === "--activate") activer = true;
  else if (!args[i].startsWith("--")) cle = args[i];
  else usage(`option inconnue : ${args[i]}`);
}
if (!cle) usage("clé manquante (2e argument ou variable LLM_API_KEY)");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  usage("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables (voir .env.example)");
}

const entetes = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

async function appeler(methode, chemin, corps) {
  const reponse = await fetch(`${url}${chemin}`, {
    method: methode,
    headers: { ...entetes, Prefer: "return=minimal" },
    body: JSON.stringify(corps),
  });
  if (!reponse.ok) {
    // Le détail PostgREST ne contient pas la clé ; on n'affiche que le statut.
    throw new Error(`${methode} ${chemin} → HTTP ${reponse.status}`);
  }
}

try {
  await appeler("POST", "/rest/v1/rpc/set_llm_api_key", {
    p_fournisseur: fournisseur,
    p_cle: cle,
  });
  console.log(`Clé ${fournisseur} enregistrée (chiffrée via Vault).`);

  if (modele) {
    await appeler("PATCH", `/rest/v1/llm_providers?fournisseur=eq.${fournisseur}`, {
      modele,
    });
    console.log(`Modèle ${fournisseur} → ${modele}`);
  }

  if (activer) {
    // RG-38 : un seul fournisseur actif (index d'unicité partielle) —
    // désactivation des autres avant activation.
    await appeler("PATCH", `/rest/v1/llm_providers?fournisseur=neq.${fournisseur}`, {
      is_active: false,
    });
    await appeler("PATCH", `/rest/v1/llm_providers?fournisseur=eq.${fournisseur}`, {
      is_active: true,
    });
    console.log(`Fournisseur actif → ${fournisseur}`);
  }
} catch (erreur) {
  console.error(erreur.message);
  process.exit(1);
}
