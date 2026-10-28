# Grille de décision Bid/No-Bid

On applique la grille en deux temps : d'abord les **éliminatoires**, puis le **score** si aucun éliminatoire n'est déclenché.
Un mémo cite toujours les codes de motif ci-dessous dans `motifs_decisifs`.

Date de référence : la date d'analyse passée par l'orchestrateur (`date_reference`). Tous les délais se calculent depuis cette date.

## 1. Éliminatoires : un seul suffit pour un NO GO

| Code | Déclencheur |
|---|---|
| `KO_PERIMETRE` | L'objet du marché, ou de tous les lots accessibles, relève du hors périmètre (PROFIL §4) ou n'a aucun lien avec le cœur de métier (PROFIL §3). Un lot dans le périmètre suffit à lever ce motif. |
| `KO_HABILITATION` | Il faut un niveau de protection du secret que Néréide n'a pas (Très Secret, zone protégée à Toulon, etc.) ou une habilitation étrangère qui n'est pas reconnue par équivalence (PROFIL §6). |
| `KO_CERTIF` | La condition de participation exige une certification ou une qualification non détenue à la date limite de remise (PROFIL §5). Une certification « en cours » ne suffit pas. |
| `KO_CAPACITE_FIN` | Le CA minimum exigé dépasse le CA de Néréide, ou le montant annuel dépasse 4,3 M€, et aucun groupement avec un partenaire du PROFIL §8 ne permet de satisfaire l'exigence. |
| `KO_REFERENCES` | Les références exigées en condition de participation ne figurent pas au PROFIL §9. |
| `KO_DELAI` | La date limite est dépassée, ou il reste moins de 15 jours ouvrés entre `date_reference` et la date limite (jours fériés français exclus). |
| `KO_GEO` | Il faut une implantation, une présence permanente, une nationalité ou une langue que Néréide n'a pas (PROFIL §1 et §6). |
| `KO_ITAR` | Il faut une licence ITAR, un TAA ou un enregistrement DDTC (PROFIL §7). |
| `KO_CONTRACTUEL` | Une clause figure dans les clauses refusées par la direction (PROFIL §10). |
| `KO_RESERVE` | Le marché est réservé (ESAT, entreprises adaptées, etc.) (PROFIL §10). |

Règles d'application :
- Un éliminatoire doit reposer sur une **citation exacte** du dossier de consultation. Si l'exigence est ambiguë, mets son statut à `a_verifier`, ajoute une question à l'acheteur et ne déclenche pas l'éliminatoire.
- Le groupement lève `KO_CAPACITE_FIN` seulement s'il est **autorisé** par le RC et si un partenaire nommé au PROFIL §8 couvre l'écart.
- Une équivalence d'habilitation lève `KO_HABILITATION` seulement si le dossier l'accepte **explicitement**.

## 2. Score, si aucun éliminatoire

Chaque critère est noté de 0 à 5, puis pondéré.

| Critère | Poids | 0 | 3 | 5 |
|---|---|---|---|---|
| Adéquation au cœur de métier (PROFIL §3) | ×3 | Marginal | Adjacent | Cœur |
| Références comparables (PROFIL §9) | ×2 | Aucune | Proche | Identique |
| Valeur stratégique (PROFIL §11) | ×2 | Aucune | Client ou domaine cible | Priorité absolue |
| Probabilité de gain (pondération technique / prix, concurrence, montant dans la cible du §10) | ×2 | Prix seul, hors cible | Équilibré | Technique dominante, dans la cible |
| Charge et risque (capacité, groupement, contraintes) | ×1 | Risque fort | Maîtrisé | Faible |

Le total est sur 50.

- **Total ≥ 30 : GO**, avec le motif le plus pertinent :
  - `GO_COEUR_METIER` : l'adéquation et les références portent la décision ;
  - `GO_STRATEGIQUE` : la valeur stratégique porte la décision (R&D, nouveau client cible) ;
  - `GO_COTRAITANCE` : le GO dépend d'un groupement avec un partenaire du PROFIL §8.
- **Total < 30 : NO GO** avec `NG_SCORE_FAIBLE`.

## 3. Confiance

- `haute` : toutes les exigences décisives sont sourcées et sans ambiguïté.
- `moyenne` : une exigence décisive est `a_verifier` ou partielle.
- `faible` : le dossier est incomplet (pièces manquantes) ou le plafond de coût a été atteint avant la fin de l'analyse.
