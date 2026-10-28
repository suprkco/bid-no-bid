export const meta = {
  name: 'evaluation',
  description: 'Rejoue bid-no-bid sur les 30 appels d’offres tranchés à la main et mesure la qualité des verdicts',
  whenToUse: 'Mesurer si le système tranche bien : verdict, motif, pièges, citations, coût',
  phases: [
    { title: 'Analyse', detail: 'workflow bid-no-bid sur eval/dossiers' },
    { title: 'Vérification' },
    { title: 'Publication' },
    { title: 'Notation', detail: 'comparaison déterministe avec la vérité terrain' },
  ],
}

// args : { run, date_reference: '2026-11-02', verite: [...contenu de eval/verite/verite.json], ids?: ['AO-04', …], plafond_usd? }
// La vérité terrain est passée par le fil principal : les analystes n'y ont jamais accès (hook garde-analyste).
const A = args || {}
if (!A.run || !A.date_reference || !Array.isArray(A.verite)) throw new Error('args.run, args.date_reference et args.verite (tableau) sont obligatoires')

const SEUILS = { exactitude: 0.9, bonne_raison: 0.8, citations: 0.95, faux_go_max: 1 }
const verite = A.ids ? A.verite.filter(v => A.ids.includes(v.id)) : A.verite
if (A.ids && verite.length < A.ids.length) log(`Identifiants inconnus ignorés : ${A.ids.filter(i => !verite.some(v => v.id === i)).join(', ')}`)
const SORTIE = `eval/resultats/${A.run}`

const argsLot = {
  run: A.run,
  date_reference: A.date_reference,
  plafond_usd: A.plafond_usd,
  dossier_sortie: `${SORTIE}/memos`,
  dossiers: verite.map(v => ({ id: v.id, chemin: `eval/dossiers/${v.id}.md` })),
}
// Par nom si le registre l'a chargé (session ouverte après la création du dépôt), sinon par chemin.
let lot
try {
  lot = await workflow('bid-no-bid', argsLot)
} catch (e) {
  if (!/no workflow with that name|not found/i.test(String(e && e.message))) throw e
  lot = await workflow({ scriptPath: '.claude/workflows/bid-no-bid.js' }, argsLot)
}

// ---------------------------------------------------------------- Notation (déterministe)
phase('Notation')
const parId = {}
for (const r of lot.resultats) parId[r.id] = r

const lignes = verite.map(v => {
  const r = parId[v.id]
  const predit = r && !r.echec ? r.verdict : null
  const motifsOk = [v.motif_principal].concat(v.motifs_acceptables || [])
  const juste = predit === v.verdict
  const bonneRaison = juste && !!r.motifs && r.motifs.some(m => motifsOk.includes(m))
  return { v, r, predit, juste, bonneRaison }
})

const n = lignes.length
const compte = f => lignes.filter(f).length
const ratio = (a, b) => (b ? a / b : null)
const pct = x => (x == null ? '—' : `${(100 * x).toFixed(1)} %`)

const vraiGo = compte(l => l.v.verdict === 'GO' && l.predit === 'GO')
const fauxGo = compte(l => l.v.verdict === 'NO_GO' && l.predit === 'GO')
const vraiNoGo = compte(l => l.v.verdict === 'NO_GO' && l.predit === 'NO_GO')
const fauxNoGo = compte(l => l.v.verdict === 'GO' && l.predit === 'NO_GO')
const echecs = compte(l => l.predit === null)
const precisionGo = ratio(vraiGo, vraiGo + fauxGo)
const rappelGo = ratio(vraiGo, compte(l => l.v.verdict === 'GO'))
const f1Go = precisionGo != null && rappelGo != null && precisionGo + rappelGo > 0 ? (2 * precisionGo * rappelGo) / (precisionGo + rappelGo) : null

const pieges = lignes.filter(l => l.v.piege)
const citTotal = lignes.reduce((t, l) => t + (l.r && l.r.citations ? l.r.citations.total : 0), 0)
const citOk = lignes.reduce((t, l) => t + (l.r && l.r.citations ? l.r.citations.verifiees : 0), 0)
const couts = lignes.map(l => l.r && l.r.cout_usd).filter(c => typeof c === 'number')

const metriques = {
  n,
  exactitude: ratio(compte(l => l.juste), n),
  bonne_raison: ratio(compte(l => l.bonneRaison), n),
  confusion: { vrai_go: vraiGo, faux_go: fauxGo, vrai_no_go: vraiNoGo, faux_no_go: fauxNoGo, echecs },
  precision_go: precisionGo,
  rappel_go: rappelGo,
  f1_go: f1Go,
  rappel_no_go: ratio(vraiNoGo, compte(l => l.v.verdict === 'NO_GO')),
  pieges: { n: pieges.length, exactitude: ratio(pieges.filter(l => l.juste).length, pieges.length) },
  citations: { total: citTotal, verifiees: citOk, taux: ratio(citOk, citTotal) },
  cout: {
    total_usd: Number(couts.reduce((t, c) => t + c, 0).toFixed(4)),
    moyen_usd: couts.length ? Number((couts.reduce((t, c) => t + c, 0) / couts.length).toFixed(4)) : null,
    max_usd: couts.length ? Math.max(...couts) : null,
    plafonnes: compte(l => l.r && l.r.plafond_atteint),
  },
  calibration: ['haute', 'moyenne', 'faible'].map(c => {
    const g = lignes.filter(l => l.r && l.r.confiance === c)
    return { confiance: c, n: g.length, exactitude: ratio(g.filter(l => l.juste).length, g.length) }
  }),
}

const barre = [
  { critere: `Exactitude du verdict ≥ ${pct(SEUILS.exactitude)}`, mesure: pct(metriques.exactitude), ok: metriques.exactitude >= SEUILS.exactitude },
  { critere: `Verdict juste pour la bonne raison ≥ ${pct(SEUILS.bonne_raison)}`, mesure: pct(metriques.bonne_raison), ok: metriques.bonne_raison >= SEUILS.bonne_raison },
  { critere: `Citations retrouvées mot pour mot ≥ ${pct(SEUILS.citations)}`, mesure: pct(metriques.citations.taux), ok: (metriques.citations.taux || 0) >= SEUILS.citations },
  { critere: `Faux GO (offre montée pour rien) ≤ ${SEUILS.faux_go_max}`, mesure: String(fauxGo), ok: fauxGo <= SEUILS.faux_go_max },
]
const valide = barre.every(b => b.ok)
const verdictLisible = v => (v === 'GO' ? 'GO' : v === 'NO_GO' ? 'NO GO' : 'échec')
const cellule = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

const rapport = [
  `# Évaluation ${A.run} : ${valide ? 'VALIDÉ' : 'NON VALIDÉ'}`,
  '',
  `${n} appels d'offres tranchés à la main (vérité terrain : \`eval/verite/verite.json\`) · date de référence ${A.date_reference} · coût total des analystes ${metriques.cout.total_usd.toFixed(2)} $`,
  '',
  '## Barre de validation',
  '',
  '| Critère | Mesuré | |',
  '|---|---|---|',
  ...barre.map(b => `| ${b.critere} | ${b.mesure} | ${b.ok ? '✅' : '❌'} |`),
  '',
  '## Métriques',
  '',
  '| | Prédit GO | Prédit NO GO | Échec |',
  '|---|---|---|---|',
  `| **Vrai GO** | ${vraiGo} | ${fauxNoGo} | ${compte(l => l.v.verdict === 'GO' && l.predit === null)} |`,
  `| **Vrai NO GO** | ${fauxGo} | ${vraiNoGo} | ${compte(l => l.v.verdict === 'NO_GO' && l.predit === null)} |`,
  '',
  `- Précision GO ${pct(precisionGo)} · rappel GO ${pct(rappelGo)} · F1 GO ${pct(f1Go)} · rappel NO GO ${pct(metriques.rappel_no_go)}`,
  `- Pièges (exigence éliminatoire enfouie, ou GO sauvé par un lot ou un groupement) : ${pieges.filter(l => l.juste).length}/${pieges.length} justes`,
  `- Citations retrouvées mot pour mot : ${citOk}/${citTotal}`,
  `- Coût analyste : moyen ${metriques.cout.moyen_usd == null ? '?' : metriques.cout.moyen_usd.toFixed(2) + ' $'}, max ${metriques.cout.max_usd == null ? '?' : metriques.cout.max_usd.toFixed(2) + ' $'}, ${metriques.cout.plafonnes} analyste(s) arrêté(s) par le plafond`,
  `- Calibration : ${metriques.calibration.map(c => `confiance ${c.confiance} ${c.n ? `${c.n} cas, ${pct(c.exactitude)} justes` : '0 cas'}`).join(' · ')}`,
  '',
  '## Détail par appel d’offres',
  '',
  '| AO | Attendu | Prédit | Motif attendu | Motifs prédits | Raison | Piège | Coût |',
  '|---|---|---|---|---|---|---|---|',
  ...lignes.map(l => `| [${l.v.id}](memos/${l.v.id}.md) | ${verdictLisible(l.v.verdict)} | ${l.juste ? '' : '❌ '}${verdictLisible(l.predit)} | ${l.v.motif_principal} | ${l.r && l.r.motifs ? l.r.motifs.join(', ') : ''} | ${l.bonneRaison ? '✅' : l.juste ? '⚠️' : ''} | ${l.v.piege ? 'oui' : ''} | ${l.r && l.r.cout_usd != null ? l.r.cout_usd.toFixed(2) + ' $' : '?'} |`),
  '',
  '## Erreurs',
  '',
  ...(lignes.some(l => !l.bonneRaison)
    ? lignes.filter(l => !l.bonneRaison).map(l =>
      `### ${l.v.id} : attendu ${verdictLisible(l.v.verdict)} (${l.v.motif_principal}), obtenu ${verdictLisible(l.predit)}${l.r && l.r.motifs ? ` (${l.r.motifs.join(', ')})` : ''}\n\n` +
      `- **Vérité terrain** : ${cellule(l.v.justification)}\n- **Système** : ${cellule(l.r && l.r.synthese ? l.r.synthese : 'aucun mémo')}\n`)
    : ['Aucune.']),
  '',
].join('\n')

await agent(
  `Écris deux fichiers avec exactement les contenus ci-dessous, sans rien modifier. Réponds seulement « ok ».\n\n` +
  `Fichier \`${SORTIE}/rapport.md\` :\n<contenu>\n${rapport}</contenu>\n\n` +
  `Fichier \`${SORTIE}/resultats.json\` :\n<contenu>\n${JSON.stringify({ run: A.run, date_reference: A.date_reference, valide, barre, metriques, detail: lignes.map(l => ({ id: l.v.id, attendu: l.v.verdict, predit: l.predit, juste: l.juste, bonne_raison: l.bonneRaison, motifs: l.r && l.r.motifs, cout_usd: l.r && l.r.cout_usd })) }, null, 2)}\n</contenu>`,
  { phase: 'Notation', label: 'rapport', effort: 'low' })

return { valide, rapport: `${SORTIE}/rapport.md`, barre, metriques }
