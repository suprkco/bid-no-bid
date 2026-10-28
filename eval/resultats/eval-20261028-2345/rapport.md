# Évaluation eval-20261028-2345 : VALIDÉ

30 appels d'offres tranchés à la main (vérité terrain : `eval/verite/verite.json`) · date de référence 2026-11-02 · coût total des analystes 6.04 $

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
| **Vrai GO** | 11 | 0 | 0 |
| **Vrai NO GO** | 0 | 19 | 0 |

- Précision GO 100.0 % · rappel GO 100.0 % · F1 GO 100.0 % · rappel NO GO 100.0 %
- Pièges (exigence éliminatoire enfouie, ou GO sauvé par un lot ou un groupement) : 11/11 justes
- Citations retrouvées mot pour mot : 262/262
- Coût analyste : moyen 0.20 $, max 0.27 $, 0 analyste(s) arrêté(s) par le plafond
- Calibration : confiance haute 25 cas, 100.0 % justes · confiance moyenne 5 cas, 100.0 % justes · confiance faible 0 cas

## Détail par appel d’offres

| AO | Attendu | Prédit | Motif attendu | Motifs prédits | Raison | Piège | Coût |
|---|---|---|---|---|---|---|---|
| [AO-01](memos/AO-01.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ |  | 0.23 $ |
| [AO-02](memos/AO-02.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_CAPACITE_FIN, KO_CERTIF | ✅ |  | 0.19 $ |
| [AO-03](memos/AO-03.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ |  | 0.22 $ |
| [AO-04](memos/AO-04.md) | NO GO | NO GO | KO_HABILITATION | KO_HABILITATION | ✅ | oui | 0.19 $ |
| [AO-05](memos/AO-05.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_CERTIF | ✅ |  | 0.20 $ |
| [AO-06](memos/AO-06.md) | GO | GO | GO_STRATEGIQUE | GO_COEUR_METIER | ✅ | oui | 0.22 $ |
| [AO-07](memos/AO-07.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_CERTIF | ✅ |  | 0.17 $ |
| [AO-08](memos/AO-08.md) | NO GO | NO GO | KO_CAPACITE_FIN | KO_CAPACITE_FIN, KO_PERIMETRE | ✅ |  | 0.25 $ |
| [AO-09](memos/AO-09.md) | NO GO | NO GO | KO_DELAI | KO_DELAI | ✅ | oui | 0.20 $ |
| [AO-10](memos/AO-10.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ | oui | 0.27 $ |
| [AO-11](memos/AO-11.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_REFERENCES | ✅ |  | 0.18 $ |
| [AO-12](memos/AO-12.md) | NO GO | NO GO | KO_ITAR | KO_ITAR | ✅ | oui | 0.20 $ |
| [AO-13](memos/AO-13.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ |  | 0.20 $ |
| [AO-14](memos/AO-14.md) | NO GO | NO GO | KO_GEO | KO_GEO | ✅ |  | 0.23 $ |
| [AO-15](memos/AO-15.md) | NO GO | NO GO | KO_RESERVE | KO_RESERVE, KO_PERIMETRE | ✅ |  | 0.17 $ |
| [AO-16](memos/AO-16.md) | GO | GO | GO_STRATEGIQUE | GO_COEUR_METIER | ✅ |  | 0.21 $ |
| [AO-17](memos/AO-17.md) | NO GO | NO GO | KO_CERTIF | KO_CERTIF | ✅ | oui | 0.19 $ |
| [AO-18](memos/AO-18.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ |  | 0.20 $ |
| [AO-19](memos/AO-19.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_CERTIF | ✅ |  | 0.18 $ |
| [AO-20](memos/AO-20.md) | NO GO | NO GO | NG_SCORE_FAIBLE | NG_SCORE_FAIBLE | ✅ | oui | 0.20 $ |
| [AO-21](memos/AO-21.md) | GO | GO | GO_COTRAITANCE | GO_COTRAITANCE, GO_COEUR_METIER | ✅ | oui | 0.23 $ |
| [AO-22](memos/AO-22.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ |  | 0.21 $ |
| [AO-23](memos/AO-23.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE | ✅ | oui | 0.19 $ |
| [AO-24](memos/AO-24.md) | NO GO | NO GO | KO_REFERENCES | KO_PERIMETRE, KO_REFERENCES | ✅ | oui | 0.22 $ |
| [AO-25](memos/AO-25.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ |  | 0.19 $ |
| [AO-26](memos/AO-26.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_REFERENCES, KO_CERTIF | ✅ |  | 0.17 $ |
| [AO-27](memos/AO-27.md) | NO GO | NO GO | KO_CONTRACTUEL | KO_CONTRACTUEL | ✅ | oui | 0.19 $ |
| [AO-28](memos/AO-28.md) | NO GO | NO GO | KO_GEO | KO_GEO, KO_HABILITATION | ✅ |  | 0.18 $ |
| [AO-29](memos/AO-29.md) | NO GO | NO GO | KO_PERIMETRE | KO_PERIMETRE, KO_REFERENCES | ✅ |  | 0.18 $ |
| [AO-30](memos/AO-30.md) | GO | GO | GO_COEUR_METIER | GO_COEUR_METIER | ✅ |  | 0.22 $ |

## Erreurs

Aucune.
