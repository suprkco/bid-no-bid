---
description: Tranche GO/NO GO sur des appels d'offres (dossiers locaux, avis BOAMP/TED ou recherche)
argument-hint: "<id BOAMP/TED | dossier local | requête entre guillemets>"
---

Demande : $ARGUMENTS

1. Construis la liste des appels d'offres :
   - pour chaque sous-dossier de `dossiers/` dont le nom figure dans la demande : `{ id: <nom>, chemin: "dossiers/<nom>" }` ;
   - pour un identifiant d'avis BOAMP (ex. `26-123456`) ou TED (ex. `654321-2026`) sans dossier local : `{ id, source: "boamp" | "ted" }` ;
   - si la demande est une requête en texte libre, ne construis pas de liste et passe-la dans `requete`.
2. Lance le workflow sauvegardé `bid-no-bid` avec ces `args` (en objet JSON) : `run` (`r` suivi de la date et de l'heure courantes au format `AAAAMMJJ-HHMM`), `date_reference` (la date du jour au format `AAAA-MM-JJ`), `dossiers` et, le cas échéant, `requete`.
3. Rends le tableau de l'index (verdict, motifs, coût) et rappelle qu'aucun mémo ne part sans `scripts/valider.ps1`.
