# Bid/No-Bid défense

Une équipe d'agents qui **tranche** GO ou NO GO sur des appels d'offres de défense pour une PME, prouve chaque décision par des citations vérifiées mot pour mot, et **mesure** sur 30 cas tranchés à la main qu'elle tranche bien.

L'accès aux données n'est pas recodé : des serveurs MCP existent déjà pour BOAMP et TED. Ce dépôt construit la partie qui raisonne.

```
                         ┌───────────────────── Workflow bid-no-bid ─────────────────────┐
 BOAMP / TED (MCP)  ──►  │ Collecte ─► pipeline, un passage par appel d'offres :          │
 dossiers/ (DCE)    ──►  │   analyste-ao ──► vérif. citations ──► mémo .md               │ ──► sortie/memos/<lot>/
                         │   (plafond $ par sous-agent, hook garde-analyste)              │      index.md + AO-xx.md
                         └────────────────────────────────────────────────────────────────┘
                                                        │
                    scripts/valider.ps1 : claude -p ──► envoyer.ps1 ──► hook « defer » ──► humain o/n ──► --resume
                                                                                                │
                                                                       envoi (copie + journal, ou webhook)
```

## Composants

| Élément | Rôle |
|---|---|
| [profil/nereide-systemes.md](profil/nereide-systemes.md) | Profil de la PME fictive : métier, CA, certifications, habilitations, ITAR, références, partenaires, clauses refusées |
| [regles/grille-decision.md](regles/grille-decision.md) | Grille de décision : 10 éliminatoires codés, puis un score sur 50 (GO si ≥ 30) |
| [.claude/agents/analyste-ao.md](.claude/agents/analyste-ao.md) | Sous-agent lancé pour chaque appel d'offres. Il lit le DCE, extrait les exigences, les confronte au profil et rend un mémo structuré (schéma JSON) |
| [.claude/workflows/bid-no-bid.js](.claude/workflows/bid-no-bid.js) | Orchestrateur (outil Workflow) : collecte, puis analyse, vérification des citations et publication de chaque appel d'offres en pipeline, puis index avec les coûts |
| [.claude/workflows/evaluation.js](.claude/workflows/evaluation.js) | Banc d'évaluation : rejoue l'orchestrateur sur les 30 cas et calcule les métriques de façon déterministe |
| [.claude/hooks/garde-analyste.ps1](.claude/hooks/garde-analyste.ps1) | **Plafond de coût par sous-agent** et moindre privilège : l'analyste ne lit que profil/, regles/ et les dossiers, jamais la vérité terrain |
| [.claude/hooks/validation-humaine.ps1](.claude/hooks/validation-humaine.ps1) | **Validation humaine avant envoi** : `defer`, puis `allow` ou `deny` selon la décision enregistrée |
| [scripts/valider.ps1](scripts/valider.ps1) | Boucle Agent SDK (`claude -p` → `tool_deferred` → humain → `--resume`) |
| [scripts/envoyer.ps1](scripts/envoyer.ps1) | Envoi. Seconde barrière : il refuse tout mémo sans approbation, ou modifié après approbation (SHA-256), et toute approbation déjà utilisée |
| [eval/](eval/) | 30 dossiers de consultation et la vérité terrain ([eval/verite/verite.json](eval/verite/verite.json)) |

## Installation

1. Claude Code ≥ 2.1 (CLI ou extension), Windows PowerShell 5.1 (les hooks sont en PowerShell).
2. Copier `.mcp.exemple.json` en `.mcp.json` et y renseigner les commandes de vos serveurs MCP BOAMP et TED. Les noms `boamp` et `ted` sont attendus par l'analyste (`mcp__boamp__*`, `mcp__ted__*`).
3. Ouvrir une fois `claude` en mode interactif dans le dossier et accepter la confiance de l'espace de travail. Sans cela, `claude -p` ignore les permissions du projet.

## Utilisation

```powershell
# Analyser : dossiers déposés dans dossiers/<id>/, avis BOAMP/TED, ou recherche libre
claude -p "/analyser AO-MARINE-2026-117 26-123456"
claude -p "/analyser 'sonar Marine nationale'"

# Valider puis envoyer : chaque mémo est présenté à un humain avant de partir
powershell -File scripts/valider.ps1 -Run r20261102-0930

# Mesurer la qualité sur les 30 cas tranchés à la main
claude -p "/evaluer"
claude -p "/evaluer AO-04 AO-21 AO-27"     # sous-ensemble
```

## Mémo GO/NO GO

Chaque mémo contient :
- le verdict, les codes des motifs décisifs, le niveau de confiance et le score (ou l'éliminatoire déclenché) ;
- un tableau des exigences, où chaque ligne donne la section du profil qui justifie son statut et une **citation exacte** du DCE (document et section), vérifiée automatiquement ;
- les risques, les conditions du GO et les questions à poser à l'acheteur ;
- la traçabilité : lot, date de référence, taux de citations vérifiées, plafond atteint ou non.

## Plafond de coût par sous-agent

L'orchestrateur étiquette le prompt de chaque analyste (`[BNB run=… id=… plafond=…]`). Avant chaque appel d'outil de l'analyste, le hook `garde-analyste` retrouve son transcript, en calcule le coût réel (tokens d'entrée, de sortie et de cache, avec le tarif du modèle) et :
- sous le plafond, laisse passer et écrit le relevé dans `sortie/couts/<lot>/<ao>.json` ;
- au-delà, **refuse tout outil**. L'analyste ne peut plus que rendre son mémo, marqué `plafond_atteint` avec la confiance `faible`.

Le plafond par défaut est de 1,50 $ (`args.plafond_usd` ou la variable `BNB_PLAFOND_USD`). `maxTurns: 40` sert de garde-fou de dernier recours. Un hook `SubagentStop` enregistre le coût final, tour de remise compris.

## Validation humaine (hook `defer`)

`defer` n'existe qu'en mode non interactif (`claude -p`). `scripts/valider.ps1` lance l'agent d'envoi. Chaque appel à `envoyer.ps1` est différé : la session s'arrête avec `stop_reason: "tool_deferred"`. Le script affiche alors le mémo, recueille la décision (o/n et motif) et l'enregistre avec l'empreinte du mémo, puis reprend la session (`--resume`). Le hook relit la décision et renvoie `allow` ou `deny`. Les autres cas sont bloqués :
- en session interactive, le hook refuse l'envoi et renvoie vers `valider.ps1` ;
- un sous-agent ne peut jamais envoyer ;
- une commande qui s'écarte de la consigne est refusée d'office.

## Banc d'évaluation

30 appels d'offres fictifs (11 GO, 19 NO GO), tranchés à la main en appliquant la grille au profil, avec la date de référence 2026-11-02. Chaque cas a un verdict, un motif principal, les motifs acceptables et une justification.

**11 pièges** testent que le système lit vraiment tout le dossier :
- Très Secret enfoui dans le CCTP (AO-04) ;
- ISO 27001 exigée à la remise (AO-17) ;
- TAA ITAR (AO-12) ;
- prix fermes sur 10 ans (AO-27) ;
- délai trop court (AO-09) ;
- références de simulateurs (AO-24) ;
- « tablettes durcies » qui ne sont que de la revente (AO-20) ;
- **injection de prompt** dans le RC (AO-23) ;
- GO sauvé par un lot (AO-10), par un groupement (AO-21) ou par une équivalence d'habilitation étrangère (AO-06).

Barre de validation, calculée en JavaScript et non par un LLM :

| Critère | Seuil |
|---|---|
| Exactitude du verdict | ≥ 90 % |
| Verdict juste **pour la bonne raison** (motif décisif attendu) | ≥ 80 % |
| Citations retrouvées mot pour mot dans le DCE | ≥ 95 % |
| Faux GO (offre montée pour rien) | ≤ 1 |

Le rapport (`eval/resultats/<lot>/rapport.md`) donne aussi la matrice de confusion, la précision et le rappel GO, le score sur les pièges, la calibration par niveau de confiance, le coût par analyste et, pour chaque erreur, la justification attendue face à la synthèse du système.
