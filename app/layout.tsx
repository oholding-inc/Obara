import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Mise en page racine.
 *
 * Aucune police via next/font/google : le projet doit tourner hors ligne.
 * Les polices de titre (Archivo Condensed / Anton) arriveront en next/font/local
 * au jalon UI ; d'ici là, globals.css s'appuie sur des polices système.
 */

export const metadata: Metadata = {
  title: "O'Bara",
  description: "Plateforme d'emploi vocale et multilingue pour le secteur informel ivoirien",
};

export default function MiseEnPageRacine({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-papier font-corps text-encre antialiased">{children}</body>
    </html>
  );
}
