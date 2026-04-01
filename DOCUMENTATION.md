# SEDO — Documentation Technique Complète

> **SEDO** — Système d'Évaluation et de Développement des Opportunités
> Fintech dédiée aux MPME du Bénin — Hackathon 2026

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
3. [Installation & Démarrage](#3-installation--démarrage)
4. [Base de données](#4-base-de-données)
5. [API Backend](#5-api-backend)
6. [Score de Finançabilité](#6-score-de-finançabilité)
7. [Service STT & Passerelle Fon](#7-service-stt--passerelle-fon)
8. [Système IVR (Appel Vocal)](#8-système-ivr-appel-vocal)
9. [Simulateur Vocal](#9-simulateur-vocal)
10. [Frontend — Espace MPME](#10-frontend--espace-mpme)
11. [Frontend — Espace IMF](#11-frontend--espace-imf)
12. [Variables d'environnement](#12-variables-denvironnement)
13. [Guide d'intégration du modèle Fon](#13-guide-dintégration-du-modèle-fon)

---

## 1. Vue d'ensemble

SEDO est une plateforme fintech conçue pour aider les Micro, Petites et Moyennes Entreprises (MPME) béninoises à obtenir des financements. Elle calcule un **Score de Finançabilité** basé sur 4 dimensions et met en relation les MPME avec des offres de financement (IMF, banques, subventions).

### Acteurs

| Rôle | Description |
|------|-------------|
| **MPME** | Entrepreneur béninois — saisit ses transactions, suit son score |
| **IMF** | Institution de Microfinance — consulte les dossiers des MPME |
| **Admin** | Accès total à la plateforme |

### Modules

| Module | Description |
|--------|-------------|
| **Comptabilité** | Saisie des transactions (pictogrammes, vocal, USSD, appel automatique) |
| **Score** | Calcul et visualisation du score de finançabilité |
| **Financement** | Offres de crédit, subventions, appels à projets |
| **Connaissance Sectorielle** | Fiches sectorielles, prix marché, actualités |
| **Formalisation** | Suivi IFU / RCCM / NPI |
| **Appel Vocal IVR** | Collecte automatique par appel téléphonique |
| **Simulateur Vocal Fon** | Simulation d'appel avec agent parlant en Fon |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Compose                        │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │    │   Backend    │    │ STT Service  │  │
│  │  React/Vite  │───▶│  Node.js     │    │  FastAPI     │  │
│  │  Port 5173   │    │  Express     │    │  Python      │  │
│  └──────────────┘    │  Port 4000   │    │  Port 8000   │  │
│                      └──────┬───────┘    └──────────────┘  │
│                             │                    ▲          │
│                      ┌──────▼───────┐            │          │
│                      │  PostgreSQL  │      /api/stt         │
│                      │  Port 5432   │      /transcribe      │
│                      │  Prisma ORM  │      /transcribe-fon  │
│                      └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18, Vite, TailwindCSS, React Query, React Router |
| Backend | Node.js, Express, Prisma ORM |
| Base de données | PostgreSQL 16 |
| STT Service | Python, FastAPI, librosa, scipy |
| Authentification | JWT (jsonwebtoken) |
| Conteneurisation | Docker, Docker Compose |
| IVR | Twilio Voice API + node-cron |

---

## 3. Installation & Démarrage

### Prérequis

- Docker Desktop installé et démarré
- Git

### Démarrage

```bash
# 1. Cloner le projet
git clone https://github.com/sicmaDev/sedo.git
cd sedo

# 2. Configurer les variables d'environnement (optionnel)
cp backend/.env.example backend/.env

# 3. Démarrer tous les services
docker compose up -d

# 4. Vérifier que tout tourne
docker compose ps
```

### Vérification

| Service | URL | Statut attendu |
|---------|-----|----------------|
| Frontend | http://localhost:5173 | Page d'accueil SEDO |
| Backend API | http://localhost:4000/health | `{"status":"ok"}` |
| STT Service | http://localhost:8000/health | `{"status":"ok"}` |

### Commandes utiles

```bash
# Voir les logs du backend
docker logs sedo-backend -f

# Rebuild après modification
docker compose build backend --no-cache
docker compose up -d backend

# Accéder à la base de données
docker exec sedo-db psql -U sedo -d sedo

# Seed (données de test)
docker exec sedo-backend node prisma/seed.js
```

---

## 4. Base de données

### Schéma — 9 modèles

#### User
```
id          String   (uuid, PK)
email       String?  (unique)
password    String   (bcrypt)
role        String   "mpme" | "imf" | "admin"
fullName    String
phone       String?  (unique)
createdAt   DateTime
updatedAt   DateTime
```

#### MPMEProfile
```
id          String   (uuid, PK)
userId      String   (FK → User)
company     String
sector      String
location    String   default: "Cotonou, Bénin"
employees   Int
createdYear Int
ifuStatus   String   "Non démarré" | "En cours" | "Complet"
rccmStatus  String   "Non démarré" | "En cours" | "Complet"
npiStatus   String   "Non démarré" | "En cours" | "Complet"
ivrPhone    String?  numéro employeur pour appel automatique
ivrTime     String   default: "18:00" — heure d'appel quotidien
```

#### Transaction
```
id          String   (uuid, PK)
mpmeId      String   (FK → MPMEProfile)
type        String   "entree" | "sortie"
amount      Float
category    String   "vente" | "achat" | "depense" | "stock" | "autre"
description String?
source      String   "manuel" | "mobile_money" | "ivr"
sector      String?  secteur choisi lors de la saisie
date        DateTime
```

#### Score
```
id              String   (uuid, PK)
mpmeId          String   (FK → MPMEProfile)
total           Float    score global /100
mobileMoney     Float    composante mobile money /100
comptabilite    Float    composante comptabilité /100
formalisation   Float    composante formalisation /100
profilSectoriel Float    composante profil /100
recommendation  String?  texte personnalisé
calculatedAt    DateTime
```

#### FinancingOffer
```
id        String   (uuid, PK)
name      String
provider  String
logo      String
subtitle  String
minScore  Float    score minimum requis
maxAmount Float
rate      Float?   taux d'intérêt
duration  String?
offerType String   "credit" | "subvention" | "appel_projets"
sector    String?  null = tous secteurs
isActive  Boolean
```

#### IVRSession
```
id            String    (uuid, PK)
token         String    (unique, uuid)
mpmeId        String    (FK → MPMEProfile)
status        String    "pending" | "active" | "completed" | "expired"
step          String    "ventes" | "depenses" | "done"
venteAmount   Float?
depenseAmount Float?
venteText     String?
depenseText   String?
createdAt     DateTime
completedAt   DateTime?
expiresAt     DateTime  expire après 2h
```

#### SectorSheet
```
id          String   (uuid, PK)
sector      String   (unique)
title       String
actors      String   JSON: [{role, description}]
marketPrices String  JSON: [{item, price, unit}]
trends      String
regulation  String
tips        String   JSON: string[]
audioFile   String?
```

#### SectorNews
```
id          String   (uuid, PK)
sector      String?  null = toutes secteurs
title       String
body        String
type        String   "info" | "alerte" | "opportunite"
publishedAt DateTime
```

---

## 5. API Backend

> Base URL : `http://localhost:4000/api`
> Authentification : `Authorization: Bearer <JWT_TOKEN>`

### Auth — `/api/auth`

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/register` | Non | Créer un compte |
| POST | `/login` | Non | Se connecter, retourne JWT |
| GET | `/me` | Oui | Infos utilisateur connecté |

**POST /register**
```json
{
  "fullName": "Jean Dupont",
  "email": "jean@example.com",
  "password": "motdepasse",
  "role": "mpme",
  "company": "Mon Commerce",
  "sector": "Commerce",
  "createdYear": 2020
}
```

**POST /login**
```json
{ "email": "jean@example.com", "password": "motdepasse" }
// OU
{ "phone": "+22961000000", "password": "motdepasse" }
```

---

### MPME — `/api/mpme`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/profile` | Profil complet de la MPME |
| PUT | `/profile` | Modifier le profil |
| GET | `/stats` | Statistiques tableau de bord |

**GET /stats — Réponse**
```json
{
  "recettesMonth": 150000,
  "depensesMonth": 80000,
  "txCount": 23,
  "recettesTrend": 12.5,
  "depensesTrend": -3.2
}
```

---

### Transactions — `/api/transactions`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste paginée (filtres: type, month) |
| POST | `/` | Créer une transaction |
| DELETE | `/:id` | Supprimer une transaction |
| GET | `/history` | Historique 6 mois |
| GET | `/journal.pdf` | Télécharger le journal PDF |

**POST / — Corps**
```json
{
  "type": "entree",
  "amount": 15000,
  "category": "vente",
  "description": "Vente pagne",
  "source": "manuel",
  "sector": "Commerce",
  "date": "2026-04-01"
}
```

**GET / — Paramètres**
```
?page=1&limit=20&type=entree&month=2026-04
```

---

### Score — `/api/score`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Dernier score calculé |
| POST | `/calculate` | Recalculer le score maintenant |

**GET / — Réponse**
```json
{
  "total": 62,
  "mobileMoney": 45,
  "comptabilite": 70,
  "formalisation": 55,
  "profilSectoriel": 100,
  "recommendation": "Il vous manque 13 points pour atteindre l'éligibilité. Priorités : Finalisez votre IFU (+40 points potentiels).",
  "calculatedAt": "2026-04-01T00:00:00Z"
}
```

---

### Financement — `/api/financement`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/offers` | Offres disponibles selon le score |

---

### Secteurs — `/api/sectors`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste des secteurs disponibles |
| GET | `/:sector/sheet` | Fiche sectorielle complète |
| GET | `/:sector/news` | Actualités du secteur |
| GET | `/:sector/news/alerts` | Compteur d'alertes non lues |

---

### IVR — `/api/ivr`

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/config` | Oui (mpme) | Sauvegarder numéro + heure d'appel |
| POST | `/call/now` | Oui (mpme) | Déclencher un appel immédiatement |
| GET | `/sessions` | Oui (mpme) | Historique des sessions IVR |
| POST | `/answer/:sessionId` | Non (Twilio) | Webhook — employeur décroche |
| POST | `/ventes/:sessionId` | Non (Twilio) | Webhook — transcription ventes |
| POST | `/depenses/:sessionId` | Non (Twilio) | Webhook — transcription dépenses |
| POST | `/status/:sessionId` | Non (Twilio) | Webhook — statut de l'appel |

---

### Simulateur — `/api/simulator`

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/save` | Oui (mpme) | Sauvegarder les transactions de la simulation |

**POST /save — Corps**
```json
{
  "venteAmount": 15000,
  "depenseAmount": 8000,
  "sector": "Commerce"
}
```

---

### IMF — `/api/imf`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/mpme` | Liste des MPME avec scores |
| GET | `/mpme/:id` | Dossier complet d'une MPME |
| GET | `/stats` | Statistiques globales |
| GET | `/alerts` | MPMEs avec score critique |

---

## 6. Score de Finançabilité

Le score est calculé sur **100 points** avec 4 composantes pondérées.

### Composantes

#### Mobile Money — 30%
Basé sur les transactions `source = "mobile_money"` des 6 derniers mois.

```
Cibles :
  - 100 transactions = 100 pts (poids 60%)
  - 5 000 000 FCFA de volume = 100 pts (poids 40%)

Score = min(100, count/100 × 100) × 0.6 + min(100, volume/5000000 × 100) × 0.4
```

#### Comptabilité — 25%
Basé sur la régularité des saisies.

```
Cible : 80 transactions en 6 mois
Complétude = min(100, totalTx/80 × 100) × 0.9
Bonus manuel = min(20, txManuelles × 0.5)
Score = min(100, complétude + bonus)
```

#### Formalisation — 25%
Basé sur le statut des documents légaux.

```
IFU  : Complet = 40 pts | En cours = 20 pts | Non démarré = 0
RCCM : Complet = 35 pts | En cours = 15 pts | Non démarré = 0
NPI  : Complet = 25 pts | En cours = 10 pts | Non démarré = 0
Total max = 100 pts
```

#### Profil Sectoriel — 20%
Basé sur la complétude du profil.

```
Secteur renseigné : +30 pts
Nom entreprise   : +20 pts
Localisation     : +15 pts
Nb employés > 0  : +15 pts
Année création   : +20 pts
Total max = 100 pts
```

### Score total

```
total = mobileMoney × 0.30
      + comptabilite × 0.25
      + formalisation × 0.25
      + profilSectoriel × 0.20
```

### Seuil d'éligibilité : **75/100**

Les offres de financement sont débloquées selon `minScore` de chaque offre.

### Déclenchement du calcul

Le score est recalculé automatiquement après :
- Chaque nouvelle transaction (comptabilité)
- Chaque modification du statut IFU/RCCM/NPI (formalisation)
- Chaque session IVR/simulateur complétée

---

## 7. Service STT & Passerelle Fon

### Service principal — `main.py`

Tourne sur le port **8000**.

**POST /transcribe**
```
Content-Type: multipart/form-data
audio: <fichier audio webm/wav/ogg>
language: "fon" | "fr" | "yoruba" | "adja"
```

Réponse :
```json
{
  "reconnue": true,
  "text": "J'ai vendu pour 1000 FCFA",
  "type": "vente",
  "montant": 1000,
  "devise": "FCFA",
  "confiance": 87.3,
  "langue": "fon"
}
```

### Passerelle Fon — `fon_bridge.py`

**POST /transcribe-fon**
```
Content-Type: multipart/form-data
audio: <fichier audio webm/wav/ogg>
```

Réponse :
```json
{
  "reconnue": true,
  "text": "cinq mille francs",
  "fon_original": "asun gbè",
  "amount": 5000,
  "langue": "fon",
  "mode": "simulation"
}
```

**GET /fon-questions**
```json
{
  "bienvenue": "Mi mɔ wɛ! Un do SEDO dó...",
  "ventes": "Akwɛ étɛ wɛ a sɔ́ ná nùɖé égbé ?",
  "depenses": "Akwɛ étɛ wɛ a sɔ́ dó nùɖé égbé ?",
  "compris": "Ɛ̀ jɛ wɛ. Un ko yí gbe.",
  "repeter": "Un mɔ xó ɔ xwé ǎ. Ɖɔ xwé ɖé mì.",
  "merci": "Àgǎnmɛ! Égbé mì sín nùkún ɖé ko wlí."
}
```

---

## 8. Système IVR (Appel Vocal)

### Principe

SEDO appelle automatiquement l'employeur à une heure configurée. L'employeur décroche, répond vocalement aux questions en français ou Fon, et les montants sont automatiquement enregistrés.

### Configuration (dans l'onglet "Appel Auto" de Comptabilité)

1. Entrer le numéro de l'employeur (format `+22961XXXXXX`)
2. Choisir l'heure d'appel quotidien
3. Sauvegarder

### Flux d'un appel

```
[Cron job — chaque minute]
  → Vérifie si une MPME a ivrTime == heure actuelle
  → Vérifie qu'on n'a pas déjà appelé aujourd'hui
  → Crée une IVRSession
  → Twilio déclenche l'appel

[Employeur décroche]
  → POST /api/ivr/answer/:sessionId
  → Agent dit en français : "Bonjour, ici SEDO..."
  → Gather input speech → /api/ivr/ventes/:sessionId

[Réponse ventes]
  → Twilio envoie SpeechResult
  → extractAmount() extrait le montant
  → Transaction "entree" créée en base
  → Agent pose la question dépenses

[Réponse dépenses]
  → Transaction "sortie" créée en base
  → Agent récapitule et raccroche
  → Score recalculé
```

### Configuration Twilio

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+12025551234
APP_URL=https://ton-backend.railway.app
```

> `APP_URL` doit être une URL publique accessible par Twilio pour les webhooks.

---

## 9. Simulateur Vocal

Accessible via l'onglet **"Appel Vocal"** dans la navigation MPME (`/mpme/simulateur`).

### Fonctionnement

Simule un vrai appel téléphonique dans le navigateur :

1. Cliquer sur **📞** — sonnerie 3 secondes
2. L'agent parle en **Fon** : *"Akwɛ étɛ wɛ a sɔ́ ná nùɖé égbé ?"*
3. L'audio est enregistré (6 secondes max) et envoyé à `/transcribe-fon`
4. Le montant est extrait → transaction **entrée** créée
5. L'agent pose la question dépenses en Fon
6. Transaction **sortie** créée
7. Score recalculé automatiquement

### Fallback clavier

Si le microphone ne fonctionne pas, un champ de saisie apparaît automatiquement pendant l'écoute.

### Compatibilité

- Chrome / Edge : complet (voix + micro)
- Firefox : micro non supporté (clavier uniquement)
- Android Chrome : recommandé pour la démo

---

## 10. Frontend — Espace MPME

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/mpme` | Dashboard | Statistiques du mois, score, transactions récentes |
| `/mpme/comptabilite` | Comptabilité | Saisie transactions (4 modes) + historique |
| `/mpme/score` | Score | Visualisation détaillée du score |
| `/mpme/financement` | Financement | Offres disponibles selon score |
| `/mpme/secteur` | Secteur | Fiche sectorielle + actualités |
| `/mpme/simulateur` | Simulateur Vocal | Appel vocal Fon |
| `/mpme/profil` | Profil | Informations entreprise |

### Module Comptabilité — 4 modes de saisie

#### 1. Pictogrammes
Saisie en 3 étapes : secteur → type (entrée/sortie) → montant.

#### 2. Vocal
Enregistrement audio via microphone → STT service → extraction montant.

#### 3. USSD
Simulation du menu `*123#` via clavier numérique.

#### 4. Appel Auto (IVR)
Configuration numéro employeur + heure → appel automatique quotidien via Twilio.

---

## 11. Frontend — Espace IMF

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/imf` | Dashboard | Vue globale du portefeuille |
| `/imf/mpme` | MPMEs | Liste avec scores et filtres |
| `/imf/dossier/:id` | Dossier | Dossier complet d'une MPME |
| `/imf/rapports` | Rapports | Statistiques sectorielles |
| `/imf/alertes` | Alertes | MPMEs en difficulté |
| `/imf/profil` | Profil | Informations institution |

---

## 12. Variables d'environnement

### Backend (`backend/.env`)

```env
# Base de données
DATABASE_URL="postgresql://sedo:sedo2026@postgres:5432/sedo"

# Authentification
JWT_SECRET="sedo_jwt_secret_hackathon_2026"

# Serveur
PORT=4000
NODE_ENV=development

# Service STT
STT_SERVICE_URL="http://stt-service:8000"

# Twilio IVR (optionnel — IVR désactivé si absent)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
APP_URL="https://ton-backend.railway.app"
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:4000
VITE_STT_URL=http://localhost:8000
```

---

## 13. Guide d'intégration du modèle Fon

Quand ton modèle Fon personnalisé est prêt, ouvre `stt-service/fon_bridge.py` et modifie **2 fonctions** :

### Étape 1 — Charger le modèle

```python
def load_fon_model():
    global FON_MODEL

    # === Whisper fine-tuné ===
    import whisper
    FON_MODEL = whisper.load_model("./models/fon_model.pt")

    # === HuggingFace Transformers ===
    # from transformers import pipeline
    # FON_MODEL = pipeline("automatic-speech-recognition", model="./models/fon")

    # === Vosk ===
    # from vosk import Model
    # FON_MODEL = Model("./models/fon_vosk")

    print("✅ Modèle Fon chargé")
```

### Étape 2 — Appeler le modèle

```python
def transcribe_with_fon_model(audio_path: str) -> dict:

    # === Whisper ===
    result = FON_MODEL.transcribe(audio_path, language="fr")
    return {"text": result["text"], "langue": "fon"}

    # === HuggingFace ===
    # result = FON_MODEL(audio_path)
    # return {"text": result["text"], "langue": "fon"}
```

### Étape 3 — Copier le modèle dans le container

```bash
# Copier ton fichier modèle dans le dossier stt-service/models/
mkdir stt-service/models/
cp ton_modele.pt stt-service/models/fon_model.pt

# Rebuilder le service STT
docker compose build stt-service
docker compose up -d stt-service
```

### Étape 4 — Vérifier

```bash
curl http://localhost:8000/health
# → {"status": "ok", "service": "SEDO STT"}

curl http://localhost:8000/fon-questions
# → {"bienvenue": "Mi mɔ wɛ!...", "ventes": "Akwɛ étɛ..."}
```

**C'est tout.** Le simulateur, l'IVR, et la comptabilité fonctionnent automatiquement avec ton modèle.

---

## Glossaire

| Terme | Définition |
|-------|-----------|
| **MPME** | Micro, Petite et Moyenne Entreprise |
| **IMF** | Institution de Microfinance |
| **IFU** | Identifiant Fiscal Unique (Bénin) |
| **RCCM** | Registre du Commerce et du Crédit Mobilier |
| **NPI** | Numéro Personnel d'Identification |
| **IVR** | Interactive Voice Response — serveur vocal interactif |
| **STT** | Speech-To-Text — reconnaissance vocale |
| **FCFA** | Franc CFA — monnaie d'Afrique de l'Ouest |
| **Fon** | Langue locale parlée au Bénin |
| **TwiML** | Twilio Markup Language — instructions pour les appels Twilio |
| **Score** | Score de Finançabilité SEDO sur 100 points |

---

*Documentation générée le 01/04/2026 — SEDO v1.0 — Hackathon 2026*
