---
description: Mesure la qualité du système sur les 30 appels d'offres tranchés à la main
argument-hint: "[AO-01 AO-04 …] (optionnel : sous-ensemble)"
---

1. Lis `eval/verite/verite.json`.
2. Lance le workflow sauvegardé `evaluation` avec ces `args` (en objet JSON, pas en chaîne) :
   - `run` : `eval-` suivi de la date et de l'heure courantes au format `AAAAMMJJ-HHMM` ;
   - `date_reference` : le champ `date_reference` du fichier ;
   - `verite` : le tableau `appels` du fichier, tel quel ;
   - `ids` : seulement si des identifiants sont donnés ici : $ARGUMENTS
3. À la fin, donne le verdict VALIDÉ / NON VALIDÉ, la barre de validation et les erreurs, avec le lien vers `rapport.md`.

Ne modifie jamais la vérité terrain pour améliorer un score.
