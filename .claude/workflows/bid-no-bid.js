export const meta = {
  name: 'bid-no-bid',
  description: "Un sous-agent analyste par appel d'offres : mémo GO/NO GO sourcé, citations vérifiées, coûts relevés",
  whenToUse: "Trancher GO/NO GO sur une liste d'appels d'offres (dossiers locaux, ou BOAMP/TED via MCP)",
  phases: [
    { title: 'Collecte', detail: "recherche BOAMP/TED via MCP (seulement si args.requete)" },
    { title: 'Analyse', detail: "un analyste-ao par appel d'offres, plafond de coût par sous-agent" },
    { title: 'Vérification', detail: 'chaque citation est recherchée mot pour mot dans le dossier' },
    { title: 'Publication', detail: 'un mémo Markdown par appel d’offres, plus un index avec les coûts' },
  ],
}

// args : {
//   run: 'r20261102-1',                 identifiant du lot d'analyse (pas d'horloge dans un workflow)
//   date_reference: '2026-11-02',       date à partir de laquelle on compte les délais
//   dossiers: [{ id, chemin?, source? }], dossiers locaux (chemin) ou avis BOAMP/TED (source + id)
//   requete?: 'sonar Marine nationale', sinon collecte BOAMP/TED par MCP
//   max?: 10, plafond_usd?: 1.5, dossier_sortie?: 'sortie/memos/<run>'
// }
const A = args || {}
if (!A.run || !A.date_reference) throw new Error('args.run et args.date_reference sont obligatoires')
const PLAFOND = A.plafond_usd || 1.5
const SORTIE = A.dossier_sortie || `sortie/memos/${A.run}`

const MOTIFS = [
  'KO_PERIMETRE', 'KO_HABILITATION', 'KO_CERTIF', 'KO_CAPACITE_FIN', 'KO_REFERENCES', 'KO_DELAI',
  'KO_GEO', 'KO_ITAR', 'KO_CONTRACTUEL', 'KO_RESERVE',
  'GO_COEUR_METIER', 'GO_STRATEGIQUE', 'GO_COTRAITANCE', 'NG_SCORE_FAIBLE',
]

const MEMO = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'titre', 'acheteur', 'date_limite', 'montant_estime_eur', 'verdict', 'motifs_decisifs', 'confiance',
    'score', 'exigences', 'synthese', 'risques', 'conditions_go', 'questions_acheteur', 'plafond_atteint'],
  properties: {
    id: { type: 'string' },
    titre: { type: 'string' },
    acheteur: { type: 'string' },
    date_limite: { type: 'string', description: 'AAAA-MM-JJ, ou « non précisé dans le dossier »' },
    montant_estime_eur: { type: ['number', 'null'] },
    verdict: { type: 'string', enum: ['GO', 'NO_GO'] },
    motifs_decisifs: { type: 'array', minItems: 1, items: { type: 'string', enum: MOTIFS } },
    confiance: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
    score: {
      type: ['object', 'null'],
      description: 'Null si un éliminatoire est déclenché',
      additionalProperties: false,
      required: ['adequation', 'references', 'strategie', 'probabilite_gain', 'charge_risque', 'total'],
      properties: {
        adequation: { type: 'integer', minimum: 0, maximum: 5 },
        references: { type: 'integer', minimum: 0, maximum: 5 },
        strategie: { type: 'integer', minimum: 0, maximum: 5 },
        probabilite_gain: { type: 'integer', minimum: 0, maximum: 5 },
        charge_risque: { type: 'integer', minimum: 0, maximum: 5 },
        total: { type: 'integer', minimum: 0, maximum: 50 },
      },
    },
    exigences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'exigence', 'type', 'eliminatoire', 'statut', 'preuve_profil', 'document', 'section', 'citation'],
        properties: {
          ref: { type: 'string', description: 'E1, E2…' },
          exigence: { type: 'string' },
          type: { type: 'string', enum: ['participation', 'technique', 'habilitation', 'certification', 'financiere', 'references', 'delai', 'contractuelle', 'geographique', 'export', 'lots', 'autre'] },
          eliminatoire: { type: 'boolean' },
          statut: { type: 'string', enum: ['conforme', 'non_conforme', 'partiel', 'a_verifier'] },
          preuve_profil: { type: 'string', description: 'ex. PROFIL §6 : aucune habilitation Très Secret' },
          document: { type: 'string', description: 'Chemin du fichier ou référence de l’avis BOAMP/TED' },
          section: { type: 'string' },
          citation: { type: 'string', description: 'Extrait copié mot pour mot du dossier' },
        },
      },
    },
    synthese: { type: 'string' },
    risques: { type: 'array', items: { type: 'string' } },
    conditions_go: { type: 'array', items: { type: 'string' } },
    questions_acheteur: { type: 'array', items: { type: 'string' } },
    plafond_atteint: { type: 'boolean' },
  },
}

const VERIF = {
  type: 'object',
  additionalProperties: false,
  required: ['citations'],
  properties: {
    citations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'etat', 'remarque'],
        properties: {
          ref: { type: 'string' },
          etat: { type: 'string', enum: ['verifiee', 'introuvable', 'non_verifiable'] },
          remarque: { type: 'string' },
        },
      },
    },
  },
}

const COUTS = {
  type: 'object',
  additionalProperties: false,
  required: ['releves'],
  properties: {
    releves: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ao', 'cout_usd', 'plafond_usd', 'bloque'],
        properties: { ao: { type: 'string' }, cout_usd: { type: 'number' }, plafond_usd: { type: 'number' }, bloque: { type: 'boolean' } },
      },
    },
  },
}

const COLLECTE = {
  type: 'object',
  additionalProperties: false,
  required: ['appels'],
  properties: {
    appels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'source', 'titre'],
        properties: { id: { type: 'string' }, source: { type: 'string', enum: ['boamp', 'ted'] }, titre: { type: 'string' } },
      },
    },
  },
}

// ---------------------------------------------------------------- Collecte
let dossiers = A.dossiers || []
if (A.requete) {
  phase('Collecte')
  const max = A.max || 10
  const trouves = await agent(
    `Cherche les appels d'offres ouverts correspondant à « ${A.requete} » avec les outils MCP boamp et ted (charge-les via ToolSearch). ` +
    `Ne garde que les avis dont la date limite de remise est postérieure au ${A.date_reference}. ` +
    `Rends au plus ${max * 2} résultats, les plus pertinents pour une PME de défense spécialisée en acoustique sous-marine et électronique navale durcie.`,
    { schema: COLLECTE, phase: 'Collecte', label: 'collecte:boamp+ted', effort: 'low' })
  const appels = (trouves && trouves.appels) || []
  if (appels.length > max) log(`Collecte : ${appels.length} avis trouvés, seuls les ${max} premiers sont analysés (args.max).`)
  dossiers = dossiers.concat(appels.slice(0, max).map(a => ({ id: a.id, source: a.source })))
}
if (!dossiers.length) throw new Error('Aucun appel d’offres à analyser (args.dossiers vide et collecte sans résultat)')
log(`${dossiers.length} appel(s) d'offres, plafond ${PLAFOND} $ par analyste, date de référence ${A.date_reference}`)

// ---------------------------------------------------------------- Analyse → Vérification → Publication
function promptAnalyse(d) {
  const ou = d.chemin
    ? `Dossier de consultation : \`${d.chemin}\` (fichier ou dossier ; lis toutes les pièces).`
    : `Avis ${d.source.toUpperCase()} n° ${d.id} : récupère-le avec les outils MCP ${d.source} et cherche aussi d'éventuelles pièces locales dans \`dossiers/${d.id}/\`.`
  return `[BNB run=${A.run} id=${d.id} plafond=${PLAFOND}]\n` +
    `Analyse l'appel d'offres ${d.id} et tranche GO/NO GO pour Néréide Systèmes.\n${ou}\n` +
    `date_reference = ${A.date_reference}. Utilise l'identifiant « ${d.id} » dans le champ id.`
}

function promptVerif(memo, d) {
  const lignes = memo.exigences.map(e => `- ${e.ref} | document: ${e.document} | citation: ${JSON.stringify(e.citation)}`).join('\n')
  return `Vérifie que chaque citation ci-dessous figure mot pour mot dans le document indiqué ` +
    `(dossier de l'appel d'offres ${d.id}${d.chemin ? ` : \`${d.chemin}\`` : ''}). Lis le document avec Read et compare le texte. ` +
    `Ignore seulement les différences d'espaces, de retours à la ligne et de typographie des apostrophes et guillemets. ` +
    `etat = verifiee si le texte est présent, introuvable s'il est absent ou reformulé, non_verifiable si le document n'est pas un fichier local.\n\n${lignes}`
}

const cellule = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const euros = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'
const ETAT = { verifiee: '✅', introuvable: '❌ introuvable', non_verifiable: '— non vérifiable' }

function rendreMemo(m, verif) {
  const etats = {}
  for (const c of (verif && verif.citations) || []) etats[c.ref] = c.etat
  const s = m.score
  const n = m.exigences.length
  const ok = m.exigences.filter(e => etats[e.ref] === 'verifiee').length
  const liste = (titre, xs) => xs && xs.length ? `\n## ${titre}\n\n${xs.map(x => `- ${x}`).join('\n')}\n` : ''
  return [
    `# Mémo Bid/No-Bid ${m.id} : ${m.verdict === 'GO' ? 'GO' : 'NO GO'}`,
    '',
    `> ${m.titre} · ${m.acheteur}`,
    '',
    '| Verdict | Motifs décisifs | Confiance | Score | Date limite | Montant estimé |',
    '|---|---|---|---|---|---|',
    `| **${m.verdict === 'GO' ? 'GO' : 'NO GO'}** | ${m.motifs_decisifs.join(', ')} | ${m.confiance} | ${s ? `${s.total}/50` : 'éliminatoire'} | ${cellule(m.date_limite)} | ${m.montant_estime_eur == null ? 'non précisé' : euros(m.montant_estime_eur)} |`,
    '',
    '## Synthèse',
    '',
    m.synthese,
    s ? `\nScore : adéquation ${s.adequation}×3, références ${s.references}×2, stratégie ${s.strategie}×2, probabilité de gain ${s.probabilite_gain}×2, charge/risque ${s.charge_risque}×1 = **${s.total}/50** (GO si ≥ 30).` : '',
    '',
    '## Exigences confrontées au profil',
    '',
    '| # | Exigence | Élim. | Statut | Justification profil | Source | Citation | Vérif. |',
    '|---|---|---|---|---|---|---|---|',
    ...m.exigences.map(e =>
      `| ${e.ref} | ${cellule(e.exigence)} | ${e.eliminatoire ? 'oui' : ''} | ${e.statut} | ${cellule(e.preuve_profil)} | ${cellule(e.document)} ${cellule(e.section)} | « ${cellule(e.citation)} » | ${ETAT[etats[e.ref]] || '?'} |`),
    liste('Risques', m.risques),
    liste('Conditions du GO', m.conditions_go),
    liste("Questions à poser à l'acheteur", m.questions_acheteur),
    '## Traçabilité',
    '',
    `- Lot d'analyse ${A.run}, date de référence ${A.date_reference}`,
    `- Citations vérifiées mot pour mot : ${ok}/${n}`,
    `- Plafond de coût atteint : ${m.plafond_atteint ? 'oui (confiance dégradée)' : 'non'}`,
    '- Statut : **en attente de validation humaine** (`scripts/valider.ps1`)',
    '',
  ].join('\n')
}

const resultats = await pipeline(
  dossiers,
  d => agent(promptAnalyse(d), { agentType: 'analyste-ao', schema: MEMO, phase: 'Analyse', label: `analyse:${d.id}` }),
  (memo, d) => {
    if (!memo) return { d, memo: null, verif: null }
    return agent(promptVerif(memo, d), { schema: VERIF, phase: 'Vérification', label: `citations:${d.id}`, effort: 'low' })
      .then(verif => ({ d, memo, verif }))
  },
  (r, d) => {
    if (!r.memo) { log(`${d.id} : l'analyste n'a pas rendu de mémo`); return { id: d.id, echec: true } }
    const chemin = `${SORTIE}/${d.id}.md`
    return agent(
      `Écris le fichier \`${chemin}\` avec exactement le contenu ci-dessous, sans rien modifier, ajouter ni retirer. Réponds seulement « ok ».\n\n<contenu>\n${rendreMemo(r.memo, r.verif)}</contenu>`,
      { phase: 'Publication', label: `memo:${d.id}`, effort: 'low' })
      .then(() => ({ id: d.id, memo: r.memo, verif: r.verif, chemin_memo: chemin }))
  },
)

// ---------------------------------------------------------------- Coûts et index
phase('Publication')
const releve = await agent(
  `Lis tous les fichiers JSON de \`sortie/couts/${A.run}/\` (un par appel d'offres) et rends leur contenu tel quel. Si le dossier n'existe pas, rends une liste vide.`,
  { schema: COUTS, phase: 'Publication', label: 'releve-couts', effort: 'low' })
const couts = {}
for (const c of (releve && releve.releves) || []) couts[c.ao] = c

const lignes = resultats.map((r, i) => {
  const id = (r && r.id) || dossiers[i].id
  if (!r || r.echec) return { id, verdict: null, echec: true, cout: couts[id] || null }
  const etats = ((r.verif && r.verif.citations) || []).map(c => c.etat)
  return {
    id,
    verdict: r.memo.verdict,
    motifs: r.memo.motifs_decisifs,
    confiance: r.memo.confiance,
    score: r.memo.score ? r.memo.score.total : null,
    citations: { total: r.memo.exigences.length, verifiees: etats.filter(e => e === 'verifiee').length, introuvables: etats.filter(e => e === 'introuvable').length },
    plafond_atteint: r.memo.plafond_atteint || !!(couts[id] && couts[id].bloque),
    cout_usd: couts[id] ? couts[id].cout_usd : null,
    chemin_memo: r.chemin_memo,
    synthese: r.memo.synthese,
  }
})

const totalCout = lignes.reduce((t, l) => t + (l.cout_usd || 0), 0)
const index = [
  `# Lot d'analyse ${A.run}`,
  '',
  `Date de référence : ${A.date_reference} · plafond par analyste : ${PLAFOND} $ · coût total des analystes : ${totalCout.toFixed(2)} $`,
  '',
  '| Appel d’offres | Verdict | Motifs | Confiance | Score | Citations vérifiées | Coût analyste | Mémo |',
  '|---|---|---|---|---|---|---|---|',
  ...lignes.map(l => l.echec
    ? `| ${l.id} | échec | | | | | | |`
    : `| ${l.id} | ${l.verdict === 'GO' ? '**GO**' : 'NO GO'} | ${l.motifs.join(', ')} | ${l.confiance} | ${l.score == null ? '—' : l.score} | ${l.citations.verifiees}/${l.citations.total} | ${l.cout_usd == null ? '?' : l.cout_usd.toFixed(2) + ' $'}${l.plafond_atteint ? ' (plafond)' : ''} | [${l.id}.md](${l.id}.md) |`),
  '',
  'Aucun mémo n’est envoyé sans validation humaine : `powershell -File scripts/valider.ps1 -Run ' + A.run + '`.',
  '',
].join('\n')
await agent(`Écris le fichier \`${SORTIE}/index.md\` avec exactement le contenu ci-dessous. Réponds seulement « ok ».\n\n<contenu>\n${index}</contenu>`,
  { phase: 'Publication', label: 'index', effort: 'low' })

return { run: A.run, date_reference: A.date_reference, dossier_sortie: SORTIE, cout_total_usd: Number(totalCout.toFixed(4)), resultats: lignes }
