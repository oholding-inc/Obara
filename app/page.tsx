import { METIERS, NOMBRE_METIERS } from "@/lib/domain/metiers";
import { NOMBRE_COMMUNES, NOMBRE_ZONES } from "@/lib/domain/zones";
import { utiliserMocks } from "@/lib/env";

// Rendu à chaque requête : le bandeau « Mode » doit refléter l'environnement du
// serveur en cours, pas celui du build (une page prérendue le figerait).
export const dynamic = "force-dynamic";

/**
 * Page d'accueil provisoire du jalon 1 (Server Component).
 *
 * Elle ne fait qu'afficher ce que le domaine connaît (métiers, zones) et le mode
 * d'exécution. Aucune base, aucun appel externe, aucune action : le socle, rien de plus.
 * Conforme à la DA (CLAUDE.md §6) : aplats, bordures 3 px encre, angles francs.
 */

export default function PageAccueil() {
  const mocks = utiliserMocks();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="border-b-[3px] border-encre pb-6">
        <h1 className="text-7xl sm:text-9xl">O&apos;Bara</h1>
        <div aria-hidden="true" className="mt-4 h-3 w-40 bg-laterite" />
        <p className="mt-4 text-xl font-bold uppercase tracking-tight">Socle technique — jalon 1</p>
      </header>

      <section aria-label="Compteurs du domaine" className="mt-8 grid grid-cols-2 border-[3px] border-encre">
        <div className="border-r-[3px] border-encre bg-taxi p-5 text-encre sm:p-8">
          <p className="font-titre text-7xl font-black leading-none sm:text-9xl">{NOMBRE_METIERS}</p>
          <p className="mt-3 text-2xl font-bold uppercase tracking-tight">métiers</p>
        </div>
        <div className="bg-bache p-5 text-papier sm:p-8">
          <p className="font-titre text-7xl font-black leading-none sm:text-9xl">{NOMBRE_ZONES}</p>
          <p className="mt-3 text-2xl font-bold uppercase tracking-tight">zones</p>
          <p className="mt-1 font-bold">dont {NOMBRE_COMMUNES} communes</p>
        </div>
      </section>

      <p className="mt-6 bg-encre px-5 py-3 text-lg font-bold uppercase tracking-tight text-papier">
        Mode : {mocks ? "mocks activés (hors ligne)" : "services réels"}
      </p>

      <section aria-labelledby="titre-metiers" className="mt-10">
        <h2 id="titre-metiers" className="text-4xl leading-none">
          Métiers
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-[3px] border-encre text-left">
            <thead className="bg-encre text-papier">
              <tr>
                <th scope="col" className="px-3 py-2 text-sm uppercase">
                  Code
                </th>
                <th scope="col" className="px-3 py-2 text-sm uppercase">
                  Français
                </th>
                <th scope="col" className="px-3 py-2 text-sm uppercase">
                  Dioula
                </th>
                <th scope="col" className="px-3 py-2 text-sm uppercase">
                  Baoulé
                </th>
              </tr>
            </thead>
            <tbody>
              {METIERS.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 font-bold">
                    Aucun métier chargé — lib/domain/metiers.ts est vide.
                  </td>
                </tr>
              ) : (
                METIERS.map((metier) => (
                  <tr key={metier.code} className="border-t-2 border-encre">
                    <td className="px-3 py-2 font-mono text-sm">{metier.code}</td>
                    <td className="px-3 py-2 font-bold">{metier.libelle}</td>
                    <td className="px-3 py-2">{metier.libelleDioula}</td>
                    <td className="px-3 py-2">{metier.libelleBaoule}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 border-t-[3px] border-encre pt-4 text-base">
        Chargé depuis lib/domain — aucune base de données requise pour cette page
      </footer>
    </main>
  );
}
