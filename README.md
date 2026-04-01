# AutoEntrepreneur Pro 🇫🇷

Application de bureau complète pour les **auto-entrepreneurs français**.

## Fonctionnalités

### 📊 Tableau de bord
- KPI en temps réel : CA mensuel/annuel, cotisations URSSAF, factures en attente
- Graphique CA mois par mois
- Prochaine date de déclaration + montant dû calculé automatiquement
- Barre de progression vers le plafond annuel (77 700 € ou 188 700 €)

### 🧾 Gestion des factures
- Création de factures avec lignes multiples (description, quantité, prix unitaire)
- Numérotation automatique
- Statuts : Brouillon, En attente, Payée, En retard, Déclarée
- Détection automatique des factures en retard (> 30 jours)
- Export HTML/PDF de chaque facture
- Export CSV de toutes les factures
- Mention légale automatique (franchise TVA art. 293B)

### 👥 Clients
- Carnet d'adresses clients
- CA total par client calculé automatiquement
- Association client ↔ facture

### ⬡ Déclaration URSSAF
- Connexion à l'espace autoentrepreneur.urssaf.fr
- Calcul automatique des cotisations selon l'activité :
  - **BIC vente** : 12,3%
  - **BIC services** : 21,2%
  - **BNC libéral** : 21,1%
  - **CIPAV** : 21,2%
- Envoi de la déclaration en un clic
- Historique complet des déclarations avec références

### 📄 Documents
- Livre des recettes (obligatoire légalement) — format tableau + export CSV
- Récapitulatif annuel URSSAF exportable
- Liste des documents à fournir à l'URSSAF

---

## Installation & Lancement

### Prérequis
- **Node.js** v18+ : [nodejs.org](https://nodejs.org)

### Étapes

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer l'application en mode développement
npm start

# 3. Compiler en EXE (Windows)
npm run build:win

# 4. Compiler en DMG (Mac)
npm run build:mac

# 5. Compiler en AppImage (Linux)
npm run build:linux
```

Le fichier `.exe` installable se trouve dans le dossier `dist/`.

---

## Structure du projet

```
autoentrepreneur-pro/
├── main.js          # Processus principal Electron (API, fichiers, IPC)
├── preload.js       # Pont sécurisé renderer ↔ main
├── package.json     # Config + scripts de build
├── src/
│   ├── index.html   # Interface HTML
│   ├── styles.css   # Design system complet
│   └── app.js       # Logique applicative complète
└── public/
    └── icon.png     # Icône de l'application
```

---

## Données & Sécurité

- Toutes les données sont stockées **localement** dans `%APPDATA%\autoentrepreneur-pro\data.json`
- Les identifiants URSSAF sont conservés localement (chiffrés dans une future version)
- Aucune donnée n'est envoyée à des serveurs tiers

---

## Intégration URSSAF (production)

Pour une intégration réelle avec l'API URSSAF :
1. Créer un compte développeur sur [developer.urssaf.fr](https://developer.urssaf.fr)
2. Obtenir vos clés OAuth2
3. Remplacer les handlers `urssaf:connect` et `urssaf:declarer` dans `main.js`

---

## Taux URSSAF 2024

| Catégorie | Taux | Plafond annuel |
|-----------|------|----------------|
| Vente de marchandises (BIC) | 12,3% | 188 700 € |
| Prestations de services (BIC) | 21,2% | 77 700 € |
| Professions libérales (BNC) | 21,1% | 77 700 € |
| Libérales réglementées (CIPAV) | 21,2% | 77 700 € |
