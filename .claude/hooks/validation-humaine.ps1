# PreToolUse (Bash|PowerShell) : aucun mémo ne part sans validation humaine.
# Premier passage : « defer ». La session `claude -p` s'arrête avec stop_reason=tool_deferred et
# scripts/valider.ps1 présente le mémo à un humain. À la reprise (--resume), le même appel repasse ici :
# la décision enregistrée dans sortie/approbations/<tool_use_id>.json donne alors allow ou deny.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$entree = [Console]::In.ReadToEnd() | ConvertFrom-Json

$commande = [string]$entree.tool_input.command
if ($commande -notmatch 'envoyer\.ps1') { exit 0 }

. (Join-Path $PSScriptRoot 'cout-commun.ps1')

function Decider([string]$decision, [string]$raison) {
  @{ hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = $decision; permissionDecisionReason = $raison } } |
    ConvertTo-JsonAscii
  exit 0
}

if ($entree.agent_id) { Decider 'deny' "Un sous-agent ne peut pas envoyer de mémo : l'envoi passe par scripts/valider.ps1." }
# « defer » n'existe qu'en mode `claude -p`. En session interactive, il casse l'appel d'outil :
# hors du flux de validation (variable posée par scripts/valider.ps1), on refuse explicitement.
if ($env:BNB_FLUX_VALIDATION -ne '1') { Decider 'deny' "L'envoi d'un mémo passe uniquement par : powershell -File scripts/valider.ps1 -Run <lot>." }

$racine = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { [string]$entree.cwd }
$fichier = Join-Path $racine "sortie/approbations/$($entree.tool_use_id).json"

if (Test-Path $fichier) {
  $approbation = Get-Content $fichier -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($approbation.decision -eq 'approuve') { Decider 'allow' "Approuvé par $($approbation.valideur) le $($approbation.horodatage)." }
  Decider 'deny' "Envoi refusé par $($approbation.valideur) : $($approbation.commentaire)"
}

Decider 'defer' 'Validation humaine requise avant envoi.'
