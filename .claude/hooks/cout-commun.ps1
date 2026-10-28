# Fonctions partagées par les hooks : coût d'un transcript de sous-agent et étiquette BNB.

# Prix en $ par million de tokens : entrée, sortie, écriture cache (TTL 1 h = 2x l'entrée), lecture cache.
$script:Tarifs = @{
  'claude-opus-5-5'   = @(4.00, 20.00, 8.00, 0.20)
  'claude-opus-5'     = @(5.00, 25.00, 10.00, 0.50)
  'claude-sonnet-5-5' = @(2.00, 10.00, 4.00, 0.20)
  'claude-haiku-5-5'  = @(0.10, 0.50, 0.20, 0.01)
  'claude-fable-5-1'  = @(10.00, 50.00, 20.00, 0.25)
}

function Get-Tarif([string]$modele) {
  foreach ($cle in $script:Tarifs.Keys) { if ($modele -like "$cle*") { return $script:Tarifs[$cle] } }
  return $script:Tarifs['claude-opus-5-5']
}

# Somme le coût d'un transcript JSONL. Un même message peut apparaître sur plusieurs lignes
# (un bloc de contenu par ligne) : on garde le dernier relevé d'usage par identifiant de message.
function Measure-CoutTranscript([string]$chemin) {
  $parMessage = @{}
  foreach ($ligne in [IO.File]::ReadAllLines($chemin)) {
    if ($ligne -notmatch '"usage"') { continue }
    try { $e = $ligne | ConvertFrom-Json } catch { continue }
    if (-not $e.message -or -not $e.message.usage) { continue }
    $parMessage[[string]$e.message.id] = $e.message
  }
  $total = 0.0
  foreach ($m in $parMessage.Values) {
    $t = Get-Tarif ([string]$m.model)
    $u = $m.usage
    $total += ([double]$u.input_tokens * $t[0] + [double]$u.output_tokens * $t[1] +
               [double]$u.cache_creation_input_tokens * $t[2] + [double]$u.cache_read_input_tokens * $t[3]) / 1e6
  }
  return [math]::Round($total, 4)
}

# Retrouve le transcript d'un sous-agent à partir du transcript de session (sous-agents et workflows
# sont rangés sous un dossier portant l'identifiant de session). Le chemin trouvé est mis en cache.
function Find-TranscriptAgent($entree, [string]$cache) {
  if ($entree.agent_transcript_path) { return [string]$entree.agent_transcript_path }
  $memo = Join-Path $cache "$($entree.agent_id).txt"
  if (Test-Path $memo) { return (Get-Content $memo -Raw).Trim() }
  $dossierSession = [IO.Path]::ChangeExtension([string]$entree.transcript_path, $null).TrimEnd('.')
  if (-not (Test-Path $dossierSession)) { return $null }
  $f = Get-ChildItem $dossierSession -Recurse -Filter "agent-$($entree.agent_id).jsonl" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $f) { return $null }
  New-Item -ItemType Directory -Force $cache | Out-Null
  Set-Content -Path $memo -Value $f.FullName -Encoding UTF8
  return $f.FullName
}

# L'orchestrateur place une étiquette « [BNB run=<run> id=<ao> plafond=<usd>] » dans le prompt du sous-agent.
function Get-EtiquetteBnb([string]$transcript) {
  $etiquette = @{ run = 'hors-run'; id = 'inconnu'; plafond = $null }
  $premieres = Get-Content $transcript -TotalCount 5 -Encoding UTF8 | Out-String
  if ($premieres -match '\[BNB run=([\w\-]+) id=([\w\-\.]+) plafond=([\d\.]+)\]') {
    $etiquette.run = $Matches[1]; $etiquette.id = $Matches[2]; $etiquette.plafond = [double]$Matches[3]
  }
  return $etiquette
}

# JSON dont les caractères non ASCII sont échappés (é) : la sortie ne dépend plus de l'encodage de la console.
function ConvertTo-JsonAscii {
  param([Parameter(ValueFromPipeline)]$Objet)
  process {
    [regex]::Replace(($Objet | ConvertTo-Json -Compress -Depth 6), '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
  }
}

function Write-ReleveCout([string]$racine, $etiquette, [string]$agentId, [double]$cout, [double]$plafond, [bool]$bloque) {
  $dossier = Join-Path $racine "sortie/couts/$($etiquette.run)"
  New-Item -ItemType Directory -Force $dossier | Out-Null
  [ordered]@{ ao = $etiquette.id; agent_id = $agentId; cout_usd = $cout; plafond_usd = $plafond; bloque = $bloque } |
    ConvertTo-Json -Compress | Set-Content -Path (Join-Path $dossier "$($etiquette.id).json") -Encoding UTF8
}
