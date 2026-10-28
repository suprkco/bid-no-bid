# SubagentStop : relevé du coût final d'un analyste-ao (y compris le dernier tour, celui de la remise du mémo).
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
$entree = [Console]::In.ReadToEnd() | ConvertFrom-Json
. (Join-Path $PSScriptRoot 'cout-commun.ps1')
$racine = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { [string]$entree.cwd }

$transcript = Find-TranscriptAgent $entree (Join-Path $racine 'sortie/couts/.chemins')
if (-not $transcript -or -not (Test-Path $transcript)) { exit 0 }

$etiquette = Get-EtiquetteBnb $transcript
if ($entree.agent_type -ne 'analyste-ao' -and $etiquette.id -eq 'inconnu') { exit 0 }
$plafond = if ($etiquette.plafond) { $etiquette.plafond } elseif ($env:BNB_PLAFOND_USD) { [double]$env:BNB_PLAFOND_USD } else { 1.50 }
$cout = Measure-CoutTranscript $transcript
Write-ReleveCout $racine $etiquette ([string]$entree.agent_id) $cout $plafond ($cout -ge $plafond)
exit 0
