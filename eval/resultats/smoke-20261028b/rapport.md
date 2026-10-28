# Évaluation smoke-20261028b : VALIDÉ

3 appels d'offres tranchés à la main (vérité terrain : `eval/verite/verite.json`) · date de référence 2026-11-02 · coût total des analystes 0.73 $

## Barre de validation

| Critère | Mesuré | |
|---|---|---|
| Exactitude du verdict ≥ 90.0 % | 100.0 % | ✅ |
| Verdict juste pour la bonne raison ≥ 80.0 % | 100.0 % | ✅ |
| Citations retrouvées mot pour mot ≥ 95.0 % | 100.0 % | ✅ |
| Faux GO (offre montée pour rien) ≤ 1 | 0 | ✅ |

## Métriques

| | Prédit GO | Prédit NO GO | Échec |
|---|---|---|---|
| **Vrai GO** | 1 | 0 | 0 |
| **Vrai NO GO** | 0 | 2 | 0 |

- Précision GO 100.0 % · rappel GO 100.0 % · F1 GO 100.0 % · rappel NO GO 100.0 %
- Pièges (exigence éliminatoire enfouie, ou GO sauvé par un lot ou un groupement) : 3/3 justes
- Citations retrouvées mot pour mot : 26/26
- Coût analyste : moyen 0.24 $, max 0.33 $, 0 analyste(s) arrêté(s) par le plafond
- Calibration : confiance haute 2 cas, 100.0 % justes · confiance moyenne 1 cas, 100.0 % justes · confiance faible 0 cas

## Détail par appel d’offres

| AO | Attendu | Prédit | Motif attendu | Motifs prédits | Raison | Piège | Coût |
|---|---|---|---|---|---|---|---|
| [AO-04](memos/AO-04.md) | NO GO | NO GO | KO_HABILITATION | KO_HABILITATION | ✅ | oui | 0.33 $ |
| [AO-21](memos/AO-21.md) | GO | GO | GO_COTRAITANCE | GO_COTRAITANCE, GO_COEUR_METIER | ✅ | oui | 0.22 $ |
| [AO-23](memos/AO-23.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_CERTIF | ✅ | oui | 0.18 $ |

## Erreurs

Aucune.
