# Validation humaine avant envoi : boucle Agent SDK autour du hook « defer ».
#
#   powershell -File scripts/valider.ps1 -Run r20261102-0930 [-Ids AO-01,AO-03] [-Valideur "J. Martin"]
#
# 1. `claude -p` reçoit la consigne d'envoyer les mémos du lot, un appel d'outil par tour.
# 2. Chaque appel à envoyer.ps1 est « deferred » par le hook : la session s'arrête (stop_reason = tool_deferred).
# 3. Ce script affiche le mémo concerné, recueille la décision humaine et l'enregistre dans
#    sortie/approbations/<tool_use_id>.json, avec l'empreinte SHA-256 du mémo.
# 4. `claude -p --resume` : le hook relit la décision et renvoie allow ou deny. On boucle jusqu'à la fin.
param(
  [Parameter(Mandatory)][string]$Run,
  [string[]]$Ids,
  [string]$Valideur = $env:USERNAME
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$racine = Split-Path $PSScriptRoot -Parent
Set-Location $racine
$env:BNB_FLUX_VALIDATION = '1'   # lu par le hook validation-humaine : seul ce flux peut différer un envoi

$dossier = "sortie/memos/$Run"
if (-not (Test-Path $dossier)) { throw "Lot introuvable : $dossier" }
if (-not $Ids) { $Ids = Get-ChildItem $dossier -Filter 'AO*.md' | ForEach-Object BaseName }
if (-not $Ids) { $Ids = Get-ChildItem $dossier -Filter *.md | Where-Object Name -ne 'index.md' | ForEach-Object BaseName }
if (-not $Ids) { throw "Aucun mémo dans $dossier" }

$commandeAttendue = "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/envoyer.ps1 -Run $Run -Id "
$consigne = @"
Envoie les mémos suivants du lot $Run : $($Ids -join ', ').
Pour chaque mémo, dans cet ordre, exécute exactement cette commande shell, en remplaçant <id> :
$commandeAttendue<id>
Règles : une seule commande par tour, jamais deux appels d'outil dans le même tour, aucun autre outil.
Si un envoi est refusé, passe au suivant sans réessayer. Termine par un récapitulatif d'une ligne par mémo.
"@

function Invoke-Claude([string[]]$arguments) {
  $sortie = & claude @arguments --output-format json
  if ($LASTEXITCODE -ne 0 -and -not $sortie) { throw "claude a échoué (code $LASTEXITCODE)" }
  return ($sortie | Out-String | ConvertFrom-Json)
}

$resultat = Invoke-Claude @('-p', $consigne)
while ($resultat.stop_reason -eq 'tool_deferred') {
  $appel = $resultat.deferred_tool_use
  $commande = [string]$appel.input.command
  $idMemo = if ($commande -match '-Id\s+([\w\-\.]+)') { $Matches[1] } else { $null }
  $approbation = [ordered]@{
    tool_use_id = $appel.id; memo = "$Run/$idMemo"; valideur = $Valideur; horodatage = (Get-Date -Format s)
    decision = 'refuse'; commentaire = ''; sha256 = $null; commande = $commande
  }

  if (-not $idMemo -or $commande.Trim() -ne "$commandeAttendue$idMemo" -or $Ids -notcontains $idMemo) {
    Write-Host "`nCommande inattendue, refusée d'office : $commande" -ForegroundColor Red
    $approbation.commentaire = 'commande non conforme à la consigne'
  } else {
    $memo = Join-Path $dossier "$idMemo.md"
    Write-Host ("`n" + ('=' * 100)) -ForegroundColor Cyan
    Get-Content $memo -Encoding UTF8 | Write-Host
    Write-Host ('=' * 100) -ForegroundColor Cyan
    $reponse = Read-Host "Envoyer le mémo $idMemo ? [o]ui / [n]on"
    if ($reponse -match '^o') {
      $approbation.decision = 'approuve'
      $approbation.sha256 = (Get-FileHash $memo -Algorithm SHA256).Hash
    } else {
      $approbation.commentaire = Read-Host 'Motif du refus (transmis à l’agent)'
    }
  }

  New-Item -ItemType Directory -Force 'sortie/approbations' | Out-Null
  $approbation | ConvertTo-Json | Set-Content "sortie/approbations/$($appel.id).json" -Encoding UTF8
  $resultat = Invoke-Claude @('-p', '--resume', $resultat.session_id)
}

Write-Host "`n$($resultat.result)"
if ($resultat.stop_reason -eq 'tool_deferred_unavailable') { Write-Warning "L'outil différé n'était plus disponible à la reprise." }
