# Envoie un mémo validé. Appelé uniquement par l'agent d'envoi, après décision « allow » du hook validation-humaine.
# Seconde barrière : le script refuse tout mémo sans approbation humaine non consommée, ou modifié après approbation.
param(
  [Parameter(Mandatory)][string]$Run,
  [Parameter(Mandatory)][string]$Id
)
$ErrorActionPreference = 'Stop'
$racine = Split-Path $PSScriptRoot -Parent
$memo = Join-Path $racine "sortie/memos/$Run/$Id.md"
if (-not (Test-Path $memo)) { Write-Error "Mémo introuvable : $memo"; exit 1 }

$empreinte = (Get-FileHash $memo -Algorithm SHA256).Hash
$approbation = Get-ChildItem (Join-Path $racine 'sortie/approbations') -Filter *.json -ErrorAction SilentlyContinue |
  ForEach-Object { $a = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json; $a | Add-Member -NotePropertyName fichier -NotePropertyValue $_.FullName; $a } |
  Where-Object { $_.memo -eq "$Run/$Id" -and $_.decision -eq 'approuve' -and -not $_.consomme } |
  Select-Object -First 1

if (-not $approbation) { Write-Error "Envoi bloqué : aucune approbation humaine pour $Run/$Id."; exit 1 }
if ($approbation.sha256 -ne $empreinte) { Write-Error "Envoi bloqué : le mémo $Run/$Id a été modifié après approbation."; exit 1 }

$dossierEnvoi = Join-Path $racine "sortie/envoyes/$Run"
New-Item -ItemType Directory -Force $dossierEnvoi | Out-Null
Copy-Item $memo (Join-Path $dossierEnvoi "$Id.md") -Force

if ($env:BNB_WEBHOOK_URL) {
  $titre = (Get-Content $memo -TotalCount 1 -Encoding UTF8) -replace '^#\s*', ''
  $texte = Get-Content $memo -Raw -Encoding UTF8
  $corps = @{ text = "$titre (validé par $($approbation.valideur))`n$($texte.Substring(0, [Math]::Min(3000, $texte.Length)))" } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri $env:BNB_WEBHOOK_URL -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($corps)) | Out-Null
  $destination = 'webhook'
} else {
  $destination = "sortie/envoyes/$Run"
}

$journal = Join-Path $racine 'sortie/envoyes/journal.csv'
[pscustomobject]@{
  horodatage = (Get-Date -Format s); run = $Run; ao = $Id; valideur = $approbation.valideur
  approuve_le = $approbation.horodatage; sha256 = $empreinte; destination = $destination
} | Export-Csv $journal -Append -NoTypeInformation -Encoding UTF8

$a = Get-Content $approbation.fichier -Raw -Encoding UTF8 | ConvertFrom-Json
$a | Add-Member -NotePropertyName consomme -NotePropertyValue $true -Force
$a | ConvertTo-Json | Set-Content $approbation.fichier -Encoding UTF8

"Mémo $Run/$Id envoyé ($destination), validé par $($approbation.valideur)."
