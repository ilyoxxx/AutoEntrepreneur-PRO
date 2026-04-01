/* ═══════════════════════════════════════════════════════════════
   AutoEntrepreneur Pro — Application principale
   ═══════════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────────────
let DB = null;
let currentPage = 'dashboard';

// ─── URSSAF Taux 2024 ─────────────────────────────────────────────────────
const TAUX = {
  BIC:     { label: 'Vente de marchandises (BIC)',    taux: 12.3,  plafond: 188700 },
  SERVICE: { label: 'Prestations de services (BIC)',  taux: 21.2,  plafond: 77700  },
  BNC:     { label: 'Professions libérales (BNC)',    taux: 21.1,  plafond: 77700  },
  LIBERAL: { label: 'Lib. réglementées (CIPAV)',      taux: 21.2,  plafond: 77700  },
};

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MOIS_FULL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ─── Init ─────────────────────────────────────────────────────────────────
async function init() {
  if (window.electron) {
    DB = await window.electron.db.get();
  } else {
    // Dev mode fallback
    DB = {
      profile: { nom: 'Dupont', prenom: 'Jean', siret: '12345678901234', activite: 'SERVICE', adresse: '12 rue de la Paix, 75001 Paris', email: 'jean@test.fr', urssafConnected: false, urssafToken: null },
      factures: [],
      declarations: [],
      clients: [],
      settings: { tauxBIC: 12.3, tauxBNC: 21.1, tauxSERVICE: 21.2, autoCalcul: true }
    };
  }
  updateUI();
  navigate('dashboard');
}

async function saveDB() {
  if (window.electron) await window.electron.db.save(DB);
}

// ─── Navigation ───────────────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const content = document.getElementById('content');
  content.innerHTML = '';
  const pages = { dashboard, factures, clients, declarations, urssaf, documents, settings };
  if (pages[page]) pages[page](content);
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.page));
});

// ─── UI Updates ───────────────────────────────────────────────────────────
function updateUI() {
  if (!DB) return;
  const p = DB.profile;
  const name = (p.prenom || '') + ' ' + (p.nom || '');
  document.getElementById('profile-name').textContent = name.trim() || 'Mon entreprise';
  document.getElementById('avatar').textContent = getInitials(name.trim());

  const badge = document.getElementById('urssaf-status');
  if (p.urssafConnected) {
    badge.className = 'badge badge-connected';
    badge.textContent = 'URSSAF ✓';
  } else {
    badge.className = 'badge badge-disconnected';
    badge.textContent = 'URSSAF ✕';
  }

  // Quota
  const currentYear = new Date().getFullYear();
  const ca = getCAYear(currentYear);
  const plafond = TAUX[p.activite]?.plafond || 77700;
  const pct = Math.min(100, (ca / plafond) * 100);
  document.getElementById('quota-fill').style.width = pct + '%';
  document.getElementById('quota-fill').style.background = pct > 80
    ? 'linear-gradient(90deg, var(--red), var(--amber))'
    : pct > 60 ? 'linear-gradient(90deg, var(--amber), var(--amber2))'
    : 'linear-gradient(90deg, var(--accent), var(--green))';
  document.getElementById('quota-label').textContent = `${formatMoney(ca)} / ${formatMoney(plafond)}`;

  // Badge factures
  const pending = DB.factures.filter(f => f.statut === 'pending').length;
  const badge2 = document.getElementById('badge-factures');
  badge2.textContent = pending;
  badge2.style.display = pending > 0 ? 'inline' : 'none';
}

// ─── Calculs ──────────────────────────────────────────────────────────────
function getCAYear(year) {
  return DB.factures
    .filter(f => f.statut === 'paid' && new Date(f.date).getFullYear() === year)
    .reduce((s, f) => s + (f.montantHT || 0), 0);
}

function getCAMonth(year, month) {
  return DB.factures
    .filter(f => f.statut === 'paid' && new Date(f.date).getFullYear() === year && new Date(f.date).getMonth() === month)
    .reduce((s, f) => s + (f.montantHT || 0), 0);
}

function calculCotisations(ca, activite) {
  const t = TAUX[activite] || TAUX.SERVICE;
  const cotisations = ca * (t.taux / 100);
  const versementLiberatoire = activite === 'BNC' ? ca * 0.022 : ca * 0.011; // IR optionnel
  return { cotisations, taux: t.taux, versementLiberatoire };
}

// ─── Dashboard ────────────────────────────────────────────────────────────
function dashboard(el) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const caAnnuel = getCAYear(year);
  const caMois = getCAMonth(year, month);
  const { cotisations } = calculCotisations(caAnnuel, DB.profile.activite);
  const { cotisations: cotMois } = calculCotisations(caMois, DB.profile.activite);

  const facturesEnAttente = DB.factures.filter(f => f.statut === 'pending');
  const totalEnAttente = facturesEnAttente.reduce((s, f) => s + f.montantHT, 0);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Tableau de bord</div>
        <div class="page-subtitle">${MOIS_FULL[month]} ${year} — Bienvenue, ${DB.profile.prenom || 'Auto-entrepreneur'}</div>
      </div>
      <button class="btn btn-primary" onclick="openModal('nouvelle-facture')">
        + Nouvelle facture
      </button>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card green">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">CA ce mois</div>
        <div class="kpi-value text-green">${formatMoney(caMois)}</div>
        <div class="kpi-sub">Cotisations : ${formatMoney(cotMois)}</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-icon">📈</div>
        <div class="kpi-label">CA annuel ${year}</div>
        <div class="kpi-value">${formatMoney(caAnnuel)}</div>
        <div class="kpi-sub">Taux ${TAUX[DB.profile.activite]?.taux || 21.2}%</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-icon">⏳</div>
        <div class="kpi-label">En attente</div>
        <div class="kpi-value text-amber">${formatMoney(totalEnAttente)}</div>
        <div class="kpi-sub">${facturesEnAttente.length} facture(s)</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-icon">🏛️</div>
        <div class="kpi-label">URSSAF ${year}</div>
        <div class="kpi-value text-red">${formatMoney(cotisations)}</div>
        <div class="kpi-sub">Sur ${formatMoney(caAnnuel)} de CA</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-title">CA mensuel ${year}</div>
        ${renderChartCA(year)}
      </div>
      <div class="card">
        <div class="card-title">Prochaine déclaration</div>
        ${renderNextDeclaration()}
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="card-title" style="margin:0">Dernières factures</div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('factures')">Voir tout →</button>
      </div>
      ${renderFacturesTable(DB.factures.slice(-5).reverse(), true)}
    </div>
  `;
}

function renderChartCA(year) {
  const maxVal = Math.max(...Array.from({length:12}, (_,i) => getCAMonth(year, i)), 1);
  const bars = Array.from({length:12}, (_,i) => {
    const ca = getCAMonth(year, i);
    const cot = calculCotisations(ca, DB.profile.activite).cotisations;
    const h = Math.max(4, (ca / maxVal) * 100);
    return `<div class="chart-col">
      <div class="chart-bar" style="height:${h}px">
        <div class="tooltip-bar">CA: ${formatMoney(ca)}<br>Cot: ${formatMoney(cot)}</div>
      </div>
      <div class="chart-label">${MOIS[i]}</div>
    </div>`;
  }).join('');
  return `<div class="chart-bars">${bars}</div>`;
}

function renderNextDeclaration() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  // Déclaration mensuelle — deadline le 15 du mois suivant
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const deadline = new Date(nextYear, nextMonth, 15);
  const daysLeft = Math.ceil((deadline - now) / 86400000);
  const caMois = getCAMonth(year, month);
  const { cotisations, taux } = calculCotisations(caMois, DB.profile.activite);

  return `
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:13px;color:var(--text3);margin-bottom:4px">Période : ${MOIS_FULL[month]} ${year}</div>
      <div style="font-size:36px;font-weight:700;font-family:var(--mono);color:${daysLeft < 5 ? 'var(--red)' : daysLeft < 10 ? 'var(--amber2)' : 'var(--green2)'};margin:8px 0">${daysLeft}j</div>
      <div style="font-size:12px;color:var(--text3)">avant le 15/${String(nextMonth+1).padStart(2,'0')}/${nextYear}</div>
      <hr class="divider">
      <div style="text-align:left">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:var(--text3);font-size:13px">CA du mois</span>
          <span style="font-family:var(--mono);font-weight:600">${formatMoney(caMois)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:var(--text3);font-size:13px">Taux URSSAF</span>
          <span style="font-family:var(--mono);font-weight:600">${taux}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border)">
          <span style="font-weight:700">Cotisations dues</span>
          <span style="font-family:var(--mono);font-weight:700;color:var(--accent2);font-size:16px">${formatMoney(cotisations)}</span>
        </div>
      </div>
      <button class="btn btn-primary w-full mt-16" onclick="navigate('declarations')" style="justify-content:center">
        Déclarer maintenant
      </button>
    </div>
  `;
}

// ─── Factures ─────────────────────────────────────────────────────────────
function factures(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Factures</div>
        <div class="page-subtitle">${DB.factures.length} facture(s) au total</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" onclick="exportCSV()">⬇ Export CSV</button>
        <button class="btn btn-primary" onclick="openModal('nouvelle-facture')">+ Nouvelle facture</button>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:20px">
      ${renderFactureFilter('all', 'Toutes')}
      ${renderFactureFilter('paid', 'Payées')}
      ${renderFactureFilter('pending', 'En attente')}
      ${renderFactureFilter('late', 'En retard')}
      ${renderFactureFilter('draft', 'Brouillons')}
    </div>

    <div class="card">
      <div class="table-wrapper" id="factures-table">
        ${renderFacturesTable(DB.factures.slice().reverse(), false)}
      </div>
    </div>
  `;
  markLateInvoices();
}

function renderFactureFilter(val, label) {
  return `<button class="btn btn-secondary btn-sm facture-filter" data-val="${val}" onclick="filterFactures('${val}')">${label}</button>`;
}

function filterFactures(val) {
  const filtered = val === 'all' ? DB.factures : DB.factures.filter(f => f.statut === val);
  document.getElementById('factures-table').innerHTML = renderFacturesTable(filtered.slice().reverse(), false);
}

function renderFacturesTable(list, mini) {
  if (list.length === 0) return `<div class="empty-state"><div class="empty-icon">📄</div><p>Aucune facture</p></div>`;

  const header = mini
    ? `<tr><th>N°</th><th>Client</th><th>Date</th><th>Montant HT</th><th>Statut</th></tr>`
    : `<tr><th>N°</th><th>Client</th><th>Date</th><th>Montant HT</th><th>TVA</th><th>Statut</th><th>Actions</th></tr>`;

  const rows = list.map(f => {
    const tva = f.tva ? formatMoney(f.montantHT * (f.tva/100)) : '<span class="text-muted">N/A</span>';
    const actions = mini ? '' : `
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" onclick="voirFacture('${f.id}')" title="Voir">👁</button>
          ${f.statut !== 'paid' ? `<button class="btn btn-ghost btn-sm" onclick="marquerPayee('${f.id}')" title="Marquer payée">✓</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="exportFacturePDF('${f.id}')" title="Exporter">📄</button>
          <button class="btn btn-ghost btn-sm" onclick="supprimerFacture('${f.id}')" title="Supprimer" style="color:var(--red)">✕</button>
        </div>
      </td>`;
    return `<tr>
      <td class="text-mono">${f.numero}</td>
      <td style="font-weight:500">${f.client}</td>
      <td class="text-muted">${formatDate(f.date)}</td>
      <td class="text-mono">${formatMoney(f.montantHT)}</td>
      ${mini ? '' : `<td class="text-mono">${tva}</td>`}
      <td>${renderStatus(f.statut)}</td>
      ${actions}
    </tr>`;
  }).join('');

  return `<table><thead>${header}</thead><tbody>${rows}</tbody></table>`;
}

function renderStatus(s) {
  const map = {
    paid: ['status-paid', 'Payée'],
    pending: ['status-pending', 'En attente'],
    late: ['status-late', 'En retard'],
    draft: ['status-draft', 'Brouillon'],
    declared: ['status-declared', 'Déclarée'],
  };
  const [cls, label] = map[s] || ['status-draft', s];
  return `<span class="status ${cls}">${label}</span>`;
}

function markLateInvoices() {
  const today = new Date();
  let changed = false;
  DB.factures.forEach(f => {
    if (f.statut === 'pending') {
      const echeance = new Date(f.dateEcheance || f.date);
      echeance.setDate(echeance.getDate() + 30);
      if (echeance < today) { f.statut = 'late'; changed = true; }
    }
  });
  if (changed) saveDB();
}

function marquerPayee(id) {
  const f = DB.factures.find(x => x.id === id);
  if (f) {
    f.statut = 'paid';
    f.datePaiement = new Date().toISOString().split('T')[0];
    saveDB();
    navigate('factures');
    updateUI();
    toast('Facture marquée comme payée ✓', 'success');
  }
}

function supprimerFacture(id) {
  if (!confirm('Supprimer cette facture ?')) return;
  DB.factures = DB.factures.filter(x => x.id !== id);
  saveDB();
  navigate('factures');
  updateUI();
  toast('Facture supprimée', 'info');
}

// ─── Clients ──────────────────────────────────────────────────────────────
function clients(el) {
  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Clients</div>
        <div class="page-subtitle">${DB.clients.length} client(s)</div>
      </div>
      <button class="btn btn-primary" onclick="openModal('nouveau-client')">+ Nouveau client</button>
    </div>
    <div class="card">
      ${DB.clients.length === 0 ? `<div class="empty-state"><div class="empty-icon">👥</div><p>Aucun client enregistré</p></div>` :
        `<table><thead><tr><th>Nom/Société</th><th>Email</th><th>Téléphone</th><th>SIRET</th><th>CA total</th><th>Actions</th></tr></thead><tbody>
          ${DB.clients.map(c => {
            const ca = DB.factures.filter(f => f.clientId === c.id && f.statut === 'paid').reduce((s,f)=>s+f.montantHT,0);
            return `<tr>
              <td style="font-weight:600">${c.nom}</td>
              <td class="text-muted">${c.email||'-'}</td>
              <td class="text-muted">${c.tel||'-'}</td>
              <td class="text-mono" style="font-size:12px">${c.siret||'-'}</td>
              <td class="text-mono text-green">${formatMoney(ca)}</td>
              <td><div class="flex gap-8">
                <button class="btn btn-ghost btn-sm" onclick="editClient('${c.id}')">✎</button>
                <button class="btn btn-ghost btn-sm" onclick="supprimerClient('${c.id}')" style="color:var(--red)">✕</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody></table>`
      }
    </div>
  `;
}

function supprimerClient(id) {
  if (!confirm('Supprimer ce client ?')) return;
  DB.clients = DB.clients.filter(c => c.id !== id);
  saveDB();
  navigate('clients');
}

// ─── Déclarations ─────────────────────────────────────────────────────────
function declarations(el) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const caMois = getCAMonth(year, month);
  const { cotisations, taux } = calculCotisations(caMois, DB.profile.activite);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Déclarations URSSAF</div>
        <div class="page-subtitle">Déclaration mensuelle de chiffre d'affaires</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <div class="card" style="border-color:rgba(99,102,241,0.3)">
        <div class="card-title">Déclaration du mois en cours</div>
        <div style="padding:8px 0">
          <div style="font-size:20px;font-weight:700;margin-bottom:20px">${MOIS_FULL[month]} ${year}</div>

          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg3);border-radius:8px">
              <span style="color:var(--text2)">Chiffre d'affaires HT</span>
              <span class="text-mono" style="font-size:18px;font-weight:700;color:var(--green2)">${formatMoney(caMois)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--bg3);border-radius:8px">
              <span style="color:var(--text2)">Taux de cotisation</span>
              <span class="text-mono" style="font-weight:700">${taux}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:8px">
              <span style="font-weight:700;font-size:15px">💳 À payer à l'URSSAF</span>
              <span class="text-mono" style="font-size:22px;font-weight:700;color:var(--accent2)">${formatMoney(cotisations)}</span>
            </div>
          </div>

          ${DB.profile.urssafConnected ? `
            <button class="btn btn-primary w-full" style="justify-content:center" onclick="declarer()">
              ⬡ Envoyer à l'URSSAF
            </button>
          ` : `
            <button class="btn btn-secondary w-full" style="justify-content:center" onclick="navigate('urssaf')">
              ⬡ Connecter l'URSSAF d'abord
            </button>
          `}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Calcul annuel ${year}</div>
        ${renderCalcAnnuel(year)}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Historique des déclarations</div>
      ${DB.declarations.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📋</div><p>Aucune déclaration effectuée</p></div>`
        : DB.declarations.slice().reverse().map(d => `
          <div class="decl-card">
            <div>
              <div class="decl-period">${d.periode}</div>
              <div class="decl-details">CA déclaré: ${formatMoney(d.ca)} · Taux ${d.taux}%</div>
            </div>
            <div>
              <div class="decl-amount text-accent">${formatMoney(d.cotisations)}</div>
              <div class="decl-ref">${d.reference || 'Ref: ---'}</div>
            </div>
            ${renderStatus('declared')}
          </div>
        `).join('')
      }
    </div>

    <div class="card mt-16">
      <div class="card-title">📄 Documents à fournir à l'URSSAF</div>
      ${renderDocumentsURSSAF()}
    </div>
  `;
}

function renderCalcAnnuel(year) {
  let totalCA = 0, totalCot = 0;
  const rows = Array.from({length:12}, (_,i) => {
    const ca = getCAMonth(year, i);
    const { cotisations } = calculCotisations(ca, DB.profile.activite);
    totalCA += ca; totalCot += cotisations;
    return `<tr>
      <td>${MOIS[i]}</td>
      <td class="text-mono text-right">${formatMoney(ca)}</td>
      <td class="text-mono text-right text-amber">${formatMoney(cotisations)}</td>
    </tr>`;
  }).join('');

  return `<table>
    <thead><tr><th>Mois</th><th class="text-right">CA HT</th><th class="text-right">Cotisations</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="border-top:2px solid var(--border2);font-weight:700">
      <td>Total</td>
      <td class="text-mono text-right text-green">${formatMoney(totalCA)}</td>
      <td class="text-mono text-right text-red">${formatMoney(totalCot)}</td>
    </tr></tfoot>
  </table>`;
}

function renderDocumentsURSSAF() {
  const docs = [
    { icon: '📋', titre: 'Déclaration de Chiffre d\'Affaires (DCA)', detail: 'Mensuelle ou trimestrielle selon votre option', lien: 'https://www.autoentrepreneur.urssaf.fr' },
    { icon: '🪪', titre: 'Justificatif d\'identité', detail: 'CNI ou Passeport en cours de validité', lien: null },
    { icon: '🏠', titre: 'Justificatif de domicile', detail: 'Moins de 3 mois (facture EDF, téléphone, bail)', lien: null },
    { icon: '🏦', titre: 'RIB bancaire', detail: 'Pour le prélèvement automatique des cotisations', lien: null },
    { icon: '📜', titre: 'Extrait Kbis / SIRET', detail: 'Justificatif d\'immatriculation au registre des commerces', lien: null },
    { icon: '💼', titre: 'Attestation de formation professionnelle (CFP)', detail: 'Obligatoire pour certaines activités réglementées', lien: null },
    { icon: '🧾', titre: 'Factures clients', detail: 'À conserver 10 ans pour contrôle fiscal', lien: null },
    { icon: '📊', titre: 'Livre des recettes', detail: 'Registre chronologique des encaissements obligatoire', lien: null },
  ];
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
    ${docs.map(d => `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:var(--bg3);border-radius:8px;border:1px solid var(--border)">
        <span style="font-size:20px">${d.icon}</span>
        <div>
          <div style="font-weight:600;font-size:13px;margin-bottom:2px">${d.titre}</div>
          <div style="font-size:12px;color:var(--text3)">${d.detail}</div>
          ${d.lien ? `<a href="${d.lien}" style="font-size:11px;color:var(--accent2);text-decoration:none" target="_blank">Accéder →</a>` : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

async function declarer() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const ca = getCAMonth(year, month);
  const { cotisations, taux } = calculCotisations(ca, DB.profile.activite);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  if (ca === 0) {
    toast('CA du mois est 0. Déclaration zéro envoyée.', 'info');
  }

  const btn = document.querySelector('[onclick="declarer()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Envoi en cours...'; }

  try {
    let result;
    if (window.electron) {
      result = await window.electron.urssaf.declarer({
        ca, cotisations, taux,
        periode: `${MOIS_FULL[month]} ${year}`,
        dateEcheance: `${nextYear}-${String(nextMonth+1).padStart(2,'0')}-15`
      });
    } else {
      await new Promise(r => setTimeout(r, 1500));
      result = { success: true, reference: 'DECL-DEMO-' + Date.now(), montantDu: cotisations };
    }

    if (result.success) {
      DB.declarations.push({
        id: genId(),
        periode: `${MOIS_FULL[month]} ${year}`,
        mois: month, annee: year,
        ca, cotisations, taux,
        reference: result.reference,
        date: new Date().toISOString().split('T')[0],
        statut: 'declared'
      });
      // Marquer les factures de ce mois comme déclarées
      DB.factures.forEach(f => {
        if (f.statut === 'paid' && new Date(f.date).getFullYear() === year && new Date(f.date).getMonth() === month) {
          f.statut = 'declared';
        }
      });
      await saveDB();
      toast(`Déclaration envoyée ! Référence : ${result.reference}`, 'success');
      navigate('declarations');
    } else {
      toast('Erreur URSSAF : ' + result.error, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '⬡ Envoyer à l\'URSSAF'; }
    }
  } catch (e) {
    toast('Erreur de connexion URSSAF', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '⬡ Envoyer à l\'URSSAF'; }
  }
}

// ─── URSSAF ───────────────────────────────────────────────────────────────
function urssaf(el) {
  const connected = DB.profile.urssafConnected;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Connexion URSSAF</div>
        <div class="page-subtitle">Intégration avec autoentrepreneur.urssaf.fr</div>
      </div>
    </div>

    <div class="urssaf-hero">
      <div class="urssaf-logo">⬡</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:8px">URSSAF Auto-entrepreneur</div>
      <div style="color:var(--text3);margin-bottom:20px;font-size:14px">
        Connectez votre espace URSSAF pour déclarer votre CA automatiquement
      </div>
      ${connected ? `
        <span class="badge badge-connected" style="font-size:13px;padding:6px 16px">✓ Compte connecté</span>
      ` : `
        <span class="badge badge-disconnected" style="font-size:13px;padding:6px 16px">✕ Non connecté</span>
      `}
    </div>

    ${connected ? renderUrssafConnected() : renderUrssafLogin()}

    <div class="card mt-16">
      <div class="card-title">ℹ️ Comment fonctionne l'intégration URSSAF</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:8px">
        ${[
          ['1️⃣', 'Connectez votre compte', 'Saisissez vos identifiants autoentrepreneur.urssaf.fr. La connexion utilise l\'API officielle URSSAF.'],
          ['2️⃣', 'Déclarez en un clic', 'Le CA calculé depuis vos factures est envoyé directement. Plus besoin de saisir manuellement.'],
          ['3️⃣', 'Suivi automatique', 'Retrouvez vos références de déclaration, montants dus et échéances dans l\'historique.'],
        ].map(([icon, titre, detail]) => `
          <div style="padding:16px;background:var(--bg3);border-radius:8px;border:1px solid var(--border)">
            <div style="font-size:24px;margin-bottom:8px">${icon}</div>
            <div style="font-weight:700;margin-bottom:4px">${titre}</div>
            <div style="font-size:12px;color:var(--text3)">${detail}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderUrssafLogin() {
  return `
    <div class="card" style="max-width:440px;margin:0 auto">
      <div class="card-title">Connexion à votre espace</div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="form-group">
          <label class="form-label">SIRET</label>
          <input class="form-input" id="u-siret" placeholder="${DB.profile.siret || '12345678901234'}" value="${DB.profile.siret || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Mot de passe URSSAF</label>
          <input class="form-input" id="u-pass" type="password" placeholder="••••••••">
        </div>
        <button class="btn btn-primary" style="justify-content:center" id="btn-urssaf-login" onclick="connectUrssaf()">
          ⬡ Se connecter à l'URSSAF
        </button>
        <div style="font-size:12px;color:var(--text3);text-align:center">
          🔒 Vos identifiants sont chiffrés et stockés localement.<br>
          Pas de compte ? <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" style="color:var(--accent2)">Créer un espace URSSAF</a>
        </div>
      </div>
    </div>
  `;
}

function renderUrssafConnected() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const caMois = getCAMonth(year, month);
  const { cotisations } = calculCotisations(caMois, DB.profile.activite);

  return `
    <div class="urssaf-connected-info">
      <div class="info-block">
        <div class="info-block-label">SIRET</div>
        <div class="info-block-value" style="font-size:13px">${DB.profile.siret || '---'}</div>
      </div>
      <div class="info-block">
        <div class="info-block-label">CA ce mois</div>
        <div class="info-block-value text-green">${formatMoney(caMois)}</div>
      </div>
      <div class="info-block">
        <div class="info-block-label">Cotisations dues</div>
        <div class="info-block-value text-accent">${formatMoney(cotisations)}</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px">
      <button class="btn btn-danger btn-sm" onclick="deconnecterUrssaf()">Se déconnecter</button>
    </div>
  `;
}

async function connectUrssaf() {
  const siret = document.getElementById('u-siret').value.trim();
  const pass = document.getElementById('u-pass').value.trim();
  if (!siret || !pass) { toast('Remplissez tous les champs', 'error'); return; }

  const btn = document.getElementById('btn-urssaf-login');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Connexion en cours...';

  let result;
  if (window.electron) {
    result = await window.electron.urssaf.connect({ siret, password: pass });
  } else {
    await new Promise(r => setTimeout(r, 1500));
    result = { success: true, token: 'demo_' + Date.now() };
  }

  if (result.success) {
    DB.profile.urssafConnected = true;
    DB.profile.urssafToken = result.token;
    DB.profile.siret = siret;
    await saveDB();
    updateUI();
    navigate('urssaf');
    toast('Compte URSSAF connecté avec succès !', 'success');
  } else {
    toast('Connexion échouée : ' + (result.error || 'Erreur inconnue'), 'error');
    btn.disabled = false;
    btn.innerHTML = '⬡ Se connecter à l\'URSSAF';
  }
}

async function deconnecterUrssaf() {
  if (!confirm('Déconnecter le compte URSSAF ?')) return;
  DB.profile.urssafConnected = false;
  DB.profile.urssafToken = null;
  await saveDB();
  updateUI();
  navigate('urssaf');
  toast('Compte URSSAF déconnecté', 'info');
}

// ─── Documents ────────────────────────────────────────────────────────────
function documents(el) {
  const year = new Date().getFullYear();
  const caAnnuel = getCAYear(year);
  const { cotisations } = calculCotisations(caAnnuel, DB.profile.activite);

  el.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Documents officiels</div><div class="page-subtitle">Livres et registres obligatoires</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-title">📒 Livre des recettes ${year}</div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Client</th><th>Facture</th><th>Montant HT</th><th>Mode paiement</th></tr></thead>
            <tbody>
              ${DB.factures.filter(f => f.statut === 'paid' && new Date(f.date).getFullYear() === year).sort((a,b)=>new Date(a.date)-new Date(b.date)).map(f => `
                <tr>
                  <td class="text-muted">${formatDate(f.date)}</td>
                  <td>${f.client}</td>
                  <td class="text-mono">${f.numero}</td>
                  <td class="text-mono text-green">${formatMoney(f.montantHT)}</td>
                  <td class="text-muted">${f.modePaiement || 'Virement'}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:20px">Aucune recette</td></tr>'}
            </tbody>
            <tfoot><tr style="border-top:2px solid var(--border2);font-weight:700">
              <td colspan="3">Total ${year}</td>
              <td class="text-mono text-green">${formatMoney(caAnnuel)}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-secondary btn-sm" onclick="exportLivreRecettes()">⬇ Exporter le livre (CSV)</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🧾 Récapitulatif URSSAF ${year}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="padding:12px;background:var(--bg3);border-radius:8px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">NOM / PRÉNOM</div>
            <div style="font-weight:600">${DB.profile.prenom} ${DB.profile.nom}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);border-radius:8px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">SIRET</div>
            <div style="font-family:var(--mono);font-weight:600">${DB.profile.siret || '---'}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);border-radius:8px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">ACTIVITÉ</div>
            <div style="font-weight:600">${TAUX[DB.profile.activite]?.label || '---'}</div>
          </div>
          <div style="padding:12px;background:var(--bg3);border-radius:8px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">CA ANNUEL ${year}</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--green2)">${formatMoney(caAnnuel)}</div>
          </div>
          <div style="padding:12px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:8px">
            <div style="font-size:11px;color:var(--accent2);margin-bottom:4px">COTISATIONS URSSAF ${year}</div>
            <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:var(--accent2)">${formatMoney(cotisations)}</div>
          </div>
          <button class="btn btn-primary" style="justify-content:center" onclick="exportRecap()">📄 Exporter le récapitulatif</button>
        </div>
      </div>
    </div>
  `;
}

async function exportLivreRecettes() {
  const year = new Date().getFullYear();
  const rows = ['Date,Client,N° Facture,Montant HT,Mode de paiement'];
  DB.factures.filter(f => f.statut === 'paid' && new Date(f.date).getFullYear() === year)
    .sort((a,b) => new Date(a.date)-new Date(b.date))
    .forEach(f => rows.push(`${f.date},"${f.client}",${f.numero},${f.montantHT},${f.modePaiement||'Virement'}`));
  const csv = rows.join('\n');
  if (window.electron) {
    await window.electron.export.csv(csv);
  } else {
    download('livre-recettes.csv', csv, 'text/csv');
  }
  toast('Livre des recettes exporté !', 'success');
}

async function exportRecap() {
  const year = new Date().getFullYear();
  const ca = getCAYear(year);
  const { cotisations, taux } = calculCotisations(ca, DB.profile.activite);
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Récapitulatif URSSAF ${year}</title>
  <style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#222}
  h1{color:#4f46e5;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:20px}
  th,td{padding:10px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}
  .total{font-weight:bold;font-size:18px;color:#4f46e5}</style></head><body>
  <h1>Récapitulatif Auto-Entrepreneur</h1>
  <p>Année fiscale ${year}</p>
  <table>
    <tr><th>Nom / Prénom</th><td>${DB.profile.prenom} ${DB.profile.nom}</td></tr>
    <tr><th>SIRET</th><td>${DB.profile.siret||'---'}</td></tr>
    <tr><th>Adresse</th><td>${DB.profile.adresse||'---'}</td></tr>
    <tr><th>Activité</th><td>${TAUX[DB.profile.activite]?.label||'---'}</td></tr>
    <tr><th>CA annuel ${year}</th><td class="total">${formatMoney(ca)}</td></tr>
    <tr><th>Taux cotisations</th><td>${taux}%</td></tr>
    <tr><th>Cotisations URSSAF ${year}</th><td class="total">${formatMoney(cotisations)}</td></tr>
  </table>
  <p style="margin-top:20px;font-size:12px;color:#888">Document généré par AutoEntrepreneur Pro le ${new Date().toLocaleDateString('fr-FR')}</p>
  </body></html>`;

  if (window.electron) {
    await window.electron.export.pdf(html);
  } else {
    download('recap-urssaf.html', html, 'text/html');
  }
  toast('Récapitulatif exporté !', 'success');
}

// ─── Settings ─────────────────────────────────────────────────────────────
function settings(el) {
  const p = DB.profile;
  el.innerHTML = `
    <div class="page-header"><div><div class="page-title">Paramètres</div><div class="page-subtitle">Votre profil auto-entrepreneur</div></div></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-title">Informations personnelles</div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Prénom</label><input class="form-input" id="s-prenom" value="${p.prenom||''}"></div>
            <div class="form-group"><label class="form-label">Nom</label><input class="form-input" id="s-nom" value="${p.nom||''}"></div>
          </div>
          <div class="form-group"><label class="form-label">SIRET</label><input class="form-input" id="s-siret" value="${p.siret||''}" placeholder="14 chiffres"></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="s-email" type="email" value="${p.email||''}"></div>
          <div class="form-group"><label class="form-label">Adresse</label><input class="form-input" id="s-adresse" value="${p.adresse||''}"></div>
          <div class="form-group">
            <label class="form-label">Type d'activité</label>
            <select class="form-input" id="s-activite">
              ${Object.entries(TAUX).map(([k,v]) => `<option value="${k}" ${p.activite===k?'selected':''}>${v.label} (${v.taux}%)</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" onclick="sauvegarderProfil()">Enregistrer</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Taux de cotisation appliqués</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${Object.entries(TAUX).map(([k,v]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${DB.profile.activite===k?'rgba(99,102,241,0.1)':'var(--bg3)'};border-radius:8px;border:1px solid ${DB.profile.activite===k?'rgba(99,102,241,0.3)':'var(--border)'}">
              <div>
                <div style="font-size:13px;font-weight:600">${v.label}</div>
                <div style="font-size:11px;color:var(--text3)">Plafond ${formatMoney(v.plafond)}/an</div>
              </div>
              <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:${DB.profile.activite===k?'var(--accent2)':'var(--text2)'}">${v.taux}%</div>
            </div>
          `).join('')}
        </div>

        <hr class="divider">
        <div class="card-title">Informations légales</div>
        <div style="font-size:12px;color:var(--text3);line-height:1.8">
          • Taux en vigueur depuis le 1er janvier 2024<br>
          • Déclaration mensuelle ou trimestrielle<br>
          • Franchise de TVA jusqu'aux plafonds légaux<br>
          • Micro-BIC : vente de marchandises<br>
          • Micro-BNC : professions libérales<br>
          <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" style="color:var(--accent2)">→ Site officiel URSSAF</a>
        </div>
      </div>
    </div>
  `;
}

async function sauvegarderProfil() {
  DB.profile.prenom = document.getElementById('s-prenom').value.trim();
  DB.profile.nom = document.getElementById('s-nom').value.trim();
  DB.profile.siret = document.getElementById('s-siret').value.trim();
  DB.profile.email = document.getElementById('s-email').value.trim();
  DB.profile.adresse = document.getElementById('s-adresse').value.trim();
  DB.profile.activite = document.getElementById('s-activite').value;
  await saveDB();
  updateUI();
  toast('Profil enregistré !', 'success');
}

// ─── Modals ───────────────────────────────────────────────────────────────
function openModal(type) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  overlay.classList.remove('hidden');

  if (type === 'nouvelle-facture') {
    title.textContent = 'Nouvelle facture';
    body.innerHTML = buildFactureForm();
  } else if (type === 'nouveau-client') {
    title.textContent = 'Nouveau client';
    body.innerHTML = buildClientForm();
  } else if (type.startsWith('voir-facture-')) {
    const id = type.replace('voir-facture-', '');
    const f = DB.factures.find(x => x.id === id);
    title.textContent = `Facture ${f?.numero}`;
    body.innerHTML = buildFactureDetail(f);
  } else if (type.startsWith('edit-client-')) {
    const id = type.replace('edit-client-', '');
    const c = DB.clients.find(x => x.id === id);
    title.textContent = 'Modifier le client';
    body.innerHTML = buildClientForm(c);
  }
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

function buildFactureForm() {
  const now = new Date().toISOString().split('T')[0];
  const numero = 'F' + new Date().getFullYear() + '-' + String(DB.factures.length + 1).padStart(3, '0');
  const clientOptions = DB.clients.map(c => `<option value="${c.id}">${c.nom}</option>`).join('');

  return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">N° Facture</label>
          <input class="form-input" id="f-numero" value="${numero}">
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" id="f-date" type="date" value="${now}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Client</label>
        ${DB.clients.length > 0 ? `
          <select class="form-input" id="f-client-id" onchange="syncClientNom(this)">
            <option value="">— Choisir un client —</option>
            ${clientOptions}
          </select>
        ` : ''}
        <input class="form-input" id="f-client" placeholder="Nom du client" style="margin-top:${DB.clients.length>0?'8px':'0'}">
      </div>

      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <table style="margin:0">
          <thead><tr><th>Description</th><th style="width:100px">Quantité</th><th style="width:110px">Prix unit. HT</th><th style="width:90px">Total</th></tr></thead>
          <tbody id="lignes-body">
            ${buildLigneFact(0)}
          </tbody>
        </table>
        <div style="padding:10px;background:var(--bg3);border-top:1px solid var(--border)">
          <button class="btn btn-ghost btn-sm" onclick="ajouterLigne()">+ Ajouter une ligne</button>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Mode de paiement</label>
          <select class="form-input" id="f-paiement">
            <option>Virement</option><option>Chèque</option><option>Espèces</option><option>CB</option><option>PayPal</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Statut</label>
          <select class="form-input" id="f-statut">
            <option value="pending">En attente</option>
            <option value="paid">Payée</option>
            <option value="draft">Brouillon</option>
          </select>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;background:var(--bg3);border-radius:8px">
        <span style="font-weight:700">Total HT</span>
        <span class="text-mono" id="f-total-display" style="font-size:20px;font-weight:700;color:var(--green2)">0,00 €</span>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" style="justify-content:center" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary flex-1" style="justify-content:center" onclick="sauvegarderFacture()">Enregistrer la facture</button>
      </div>
    </div>
  `;
}

let ligneCount = 1;
function buildLigneFact(idx) {
  return `<tr id="ligne-${idx}">
    <td><input class="form-input" placeholder="Description" id="l-desc-${idx}" oninput="calcTotal()"></td>
    <td><input class="form-input text-mono" type="number" value="1" min="0" step="0.5" id="l-qte-${idx}" oninput="calcTotal()"></td>
    <td><input class="form-input text-mono" type="number" value="0" min="0" step="0.01" id="l-prix-${idx}" oninput="calcTotal()"></td>
    <td class="text-mono" id="l-total-${idx}" style="font-weight:600">0,00 €</td>
  </tr>`;
}

function ajouterLigne() {
  const body = document.getElementById('lignes-body');
  body.insertAdjacentHTML('beforeend', buildLigneFact(ligneCount++));
}

function calcTotal() {
  let total = 0;
  for (let i = 0; i < ligneCount; i++) {
    const qte = parseFloat(document.getElementById('l-qte-'+i)?.value) || 0;
    const prix = parseFloat(document.getElementById('l-prix-'+i)?.value) || 0;
    const t = qte * prix;
    const el = document.getElementById('l-total-'+i);
    if (el) el.textContent = formatMoney(t);
    total += t;
  }
  const disp = document.getElementById('f-total-display');
  if (disp) disp.textContent = formatMoney(total);
}

function syncClientNom(sel) {
  const c = DB.clients.find(x => x.id === sel.value);
  if (c) document.getElementById('f-client').value = c.nom;
}

async function sauvegarderFacture() {
  const clientId = document.getElementById('f-client-id')?.value || null;
  const clientNom = document.getElementById('f-client')?.value?.trim();
  if (!clientNom) { toast('Renseignez le client', 'error'); return; }

  const lignes = [];
  let total = 0;
  for (let i = 0; i < ligneCount; i++) {
    const desc = document.getElementById('l-desc-'+i)?.value;
    const qte = parseFloat(document.getElementById('l-qte-'+i)?.value) || 0;
    const prix = parseFloat(document.getElementById('l-prix-'+i)?.value) || 0;
    if (desc && qte && prix) { lignes.push({ desc, qte, prix }); total += qte * prix; }
  }

  const facture = {
    id: genId(),
    numero: document.getElementById('f-numero').value.trim(),
    date: document.getElementById('f-date').value,
    client: clientNom,
    clientId,
    lignes,
    montantHT: total,
    modePaiement: document.getElementById('f-paiement').value,
    statut: document.getElementById('f-statut').value,
  };

  DB.factures.push(facture);
  ligneCount = 1;
  await saveDB();
  updateUI();
  closeModal();
  navigate('factures');
  toast(`Facture ${facture.numero} créée !`, 'success');
}

function buildClientForm(c = null) {
  return `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label class="form-label">Nom / Société</label><input class="form-input" id="c-nom" value="${c?.nom||''}"></div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="c-email" type="email" value="${c?.email||''}"></div>
        <div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" id="c-tel" value="${c?.tel||''}"></div>
      </div>
      <div class="form-group"><label class="form-label">SIRET (optionnel)</label><input class="form-input" id="c-siret" value="${c?.siret||''}" placeholder="Pour les entreprises"></div>
      <div class="form-group"><label class="form-label">Adresse</label><input class="form-input" id="c-adresse" value="${c?.adresse||''}"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" style="justify-content:center" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary flex-1" style="justify-content:center" onclick="sauvegarderClient('${c?.id||''}')">Enregistrer</button>
      </div>
    </div>
  `;
}

async function sauvegarderClient(existingId) {
  const nom = document.getElementById('c-nom').value.trim();
  if (!nom) { toast('Le nom est obligatoire', 'error'); return; }

  const data = {
    id: existingId || genId(),
    nom,
    email: document.getElementById('c-email').value.trim(),
    tel: document.getElementById('c-tel').value.trim(),
    siret: document.getElementById('c-siret').value.trim(),
    adresse: document.getElementById('c-adresse').value.trim(),
  };

  if (existingId) {
    const idx = DB.clients.findIndex(c => c.id === existingId);
    if (idx !== -1) DB.clients[idx] = data;
  } else {
    DB.clients.push(data);
  }

  await saveDB();
  closeModal();
  navigate('clients');
  toast(`Client "${nom}" enregistré !`, 'success');
}

function voirFacture(id) { openModal('voir-facture-' + id); }
function editClient(id) { openModal('edit-client-' + id); }

function buildFactureDetail(f) {
  if (!f) return '<p>Facture introuvable</p>';
  const lignes = f.lignes || [];
  return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between">
        <div><div style="font-size:22px;font-weight:700">${f.numero}</div><div style="color:var(--text3)">${formatDate(f.date)}</div></div>
        ${renderStatus(f.statut)}
      </div>
      <div style="padding:12px;background:var(--bg3);border-radius:8px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">CLIENT</div>
        <div style="font-weight:600;font-size:15px">${f.client}</div>
      </div>
      <table>
        <thead><tr><th>Description</th><th>Qté</th><th>PU HT</th><th>Total</th></tr></thead>
        <tbody>
          ${lignes.map(l => `<tr>
            <td>${l.desc}</td>
            <td class="text-mono">${l.qte}</td>
            <td class="text-mono">${formatMoney(l.prix)}</td>
            <td class="text-mono">${formatMoney(l.qte*l.prix)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid var(--border2);font-weight:700">
          <td colspan="3">Total HT</td>
          <td class="text-mono text-green">${formatMoney(f.montantHT)}</td>
        </tr></tfoot>
      </table>
      <div style="font-size:12px;color:var(--text3)">
        Mode de paiement : ${f.modePaiement || 'Virement'}<br>
        <em>TVA non applicable — Art. 293B du CGI (auto-entrepreneur)</em>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" style="justify-content:center" onclick="closeModal()">Fermer</button>
        <button class="btn btn-primary flex-1" style="justify-content:center" onclick="exportFacturePDF('${f.id}')">📄 Exporter PDF</button>
      </div>
    </div>
  `;
}

async function exportFacturePDF(id) {
  const f = DB.factures.find(x => x.id === id);
  if (!f) return;
  const p = DB.profile;
  const lignes = f.lignes || [];
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Facture ${f.numero}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#222;font-size:14px}
    .header{display:flex;justify-content:space-between;margin-bottom:40px}
    .invoice-num{font-size:28px;font-weight:bold;color:#4f46e5}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th{background:#f0f0f5;padding:10px;text-align:left;border-bottom:2px solid #4f46e5}
    td{padding:10px;border-bottom:1px solid #eee}
    .total-row{font-weight:bold;font-size:16px;background:#f0f0f5}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#888}
    .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:#10b981;color:white}
  </style></head><body>
  <div class="header">
    <div>
      <div style="font-weight:bold;font-size:18px">${p.prenom} ${p.nom}</div>
      <div style="color:#666;margin-top:4px">${p.adresse||''}</div>
      <div style="color:#666">${p.email||''}</div>
      <div style="color:#666;font-size:12px;margin-top:4px">SIRET : ${p.siret||'---'}</div>
    </div>
    <div style="text-align:right">
      <div class="invoice-num">${f.numero}</div>
      <div style="color:#666;margin-top:4px">Date : ${formatDate(f.date)}</div>
      <div style="margin-top:8px"><span class="badge">${f.statut === 'paid' ? 'Payée' : 'En attente'}</span></div>
    </div>
  </div>
  <div style="padding:16px;background:#f9f9ff;border-radius:8px;margin-bottom:24px">
    <div style="font-size:12px;color:#888;margin-bottom:4px">FACTURÉ À</div>
    <div style="font-weight:bold;font-size:16px">${f.client}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Quantité</th><th>Prix unitaire HT</th><th>Total HT</th></tr></thead>
    <tbody>
      ${lignes.map(l => `<tr><td>${l.desc}</td><td>${l.qte}</td><td>${formatMoney(l.prix)}</td><td>${formatMoney(l.qte*l.prix)}</td></tr>`).join('')}
    </tbody>
    <tfoot>
      <tr class="total-row"><td colspan="3">Total HT</td><td>${formatMoney(f.montantHT)}</td></tr>
    </tfoot>
  </table>
  <div style="font-size:12px;color:#888">Mode de paiement : ${f.modePaiement||'Virement'}</div>
  <div class="footer">
    <em>TVA non applicable — Art. 293B du CGI</em><br>
    En cas de retard de paiement, des pénalités de 3 fois le taux d'intérêt légal seront appliquées (Art. L441-6 du Code de Commerce).
  </div></body></html>`;

  if (window.electron) {
    await window.electron.export.pdf(html);
  } else {
    download(`facture-${f.numero}.html`, html, 'text/html');
  }
  toast('Facture exportée !', 'success');
}

async function exportCSV() {
  const rows = ['N° Facture,Date,Client,Montant HT,Statut,Mode paiement'];
  DB.factures.forEach(f => rows.push(`${f.numero},${f.date},"${f.client}",${f.montantHT},${f.statut},${f.modePaiement||'Virement'}`));
  const csv = rows.join('\n');
  if (window.electron) {
    await window.electron.export.csv(csv);
  } else {
    download('factures.csv', csv, 'text/csv');
  }
  toast('Export CSV téléchargé !', 'success');
}

// ─── Utilities ────────────────────────────────────────────────────────────
function formatMoney(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}
function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function getInitials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase() || 'AE';
}
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}

// ─── Toast ────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ─── Start ────────────────────────────────────────────────────────────────
init();
