# PreToolUse : garde du sous-agent analyste-ao.
#  1. Moindre privilège : la lecture est limitée au profil, à la grille et aux dossiers de consultation.
#     L'analyste ne peut donc jamais lire la vérité terrain du banc d'évaluation.
#  2. Plafond de coût : au-delà du plafond, tout outil est refusé ; seule la remise du mémo reste possible.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$entree = [Console]::In.ReadToEnd() | ConvertFrom-Json

if (-not $entree.agent_id) { exit 0 }
if ($entree.tool_name -eq 'StructuredOutput') { exit 0 }

. (Join-Path $PSScriptRoot 'cout-commun.ps1')
$racine = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { [string]$entree.cwd }

# Un analyste se reconnaît à son type, ou à l'étiquette [BNB …] posée par l'orchestrateur
# (repli sur l'agent générique quand le type analyste-ao n'est pas chargé dans la session).
$transcript = Find-TranscriptAgent $entree (Join-Path $racine 'sortie/couts/.chemins')
$etiquette = if ($transcript -and (Test-Path $transcript)) { Get-EtiquetteBnb $transcript } else { $null }
$estAnalyste = $entree.agent_type -eq 'analyste-ao' -or ($etiquette -and $etiquette.id -ne 'inconnu')
if (-not $estAnalyste) { exit 0 }

function Refuser([string]$raison) {
  @{ hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = 'deny'; permissionDecisionReason = $raison } } |
    ConvertTo-JsonAscii
  exit 0
}

# --- 1. Moindre privilège --------------------------------------------------------------
$outilsAutorises = 'Read', 'Grep', 'Glob', 'ToolSearch'
if ($entree.tool_name -notin $outilsAutorises -and $entree.tool_name -notmatch '^mcp__(boamp|ted)__') {
  Refuser "Outil $($entree.tool_name) interdit à l'analyste : lecture seule (Read, Grep, Glob) et MCP boamp/ted."
}
$racinesAutorisees = 'profil', 'regles', 'dossiers', 'eval/dossiers', '.claude/agents' |
  ForEach-Object { [IO.Path]::GetFullPath((Join-Path $racine $_)).TrimEnd('\') + '\' }

$chemin = switch ($entree.tool_name) {
  'Read' { $entree.tool_input.file_path }
  { $_ -in 'Grep', 'Glob' } { $entree.tool_input.path }
  default { $null }
}
if ($entree.tool_name -in 'Read', 'Grep', 'Glob') {
  if (-not $chemin) {
    Refuser "Précise 'path' : la recherche est limitée à profil/, regles/, dossiers/ et eval/dossiers/."
  }
  $complet = if ([IO.Path]::IsPathRooted($chemin)) { $chemin } else { Join-Path ([string]$entree.cwd) $chemin }
  $complet = [IO.Path]::GetFullPath($complet)
  if (Test-Path $complet -PathType Container) { $complet = $complet.TrimEnd('\') + '\' }
  $autorise = $racinesAutorisees | Where-Object { $complet.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }
  if (-not $autorise -or $complet -match 'verite') {
    Refuser "Accès refusé à $chemin : l'analyste ne lit que profil/, regles/, dossiers/ et eval/dossiers/."
  }
}

# --- 2. Plafond de coût -----------------------------------------------------------------
if (-not $etiquette) { exit 0 }   # transcript pas encore écrit : maxTurns reste le garde-fou
$plafond = if ($etiquette.plafond) { $etiquette.plafond } elseif ($env:BNB_PLAFOND_USD) { [double]$env:BNB_PLAFOND_USD } else { 1.50 }
$cout = Measure-CoutTranscript $transcript
$depasse = $cout -ge $plafond
Write-ReleveCout $racine $etiquette ([string]$entree.agent_id) $cout $plafond $depasse

if ($depasse) {
  Refuser ("Plafond de coût atteint ({0:N2} $ dépensés sur {1:N2} $). N'appelle plus d'outil : rends ton mémo maintenant avec les preuves déjà réunies, plafond_atteint=true, confiance=faible." -f $cout, $plafond)
}
exit 0
