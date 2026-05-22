# FormFlow Architecture Overview

## System Components

### 1. Landings (Frontend)
- **Tech Stack:** Pure HTML/CSS (Tailwind via CDN) + Vanilla JS.
- **Purpose:** Fast, easily customizable, and freely hostable landing pages for specific niches (e.g., events, cleaning).
- **Data Flow:** Uses `submit-firebase.js` to collect all form fields via `new FormData()` and push directly to Firebase Firestore.

### 2. CRM Admin Panel
- **Tech Stack:** React, Vite, Tailwind CSS, shadcn/ui, `react-i18next`.
- **Purpose:** A mobile-friendly (PWA-ready) dashboard for clients to view and manage their incoming leads.
- **Features:** Real-time sync with Firestore (`onSnapshot`), dynamic field rendering, multilingual support (UA, RU, EN), secure lead status management.
- **Hosting:** Deployed on **Vercel**.

### 3. Backend Logic & Integrations (API)
- **Tech Stack:** Vercel Serverless Functions (`api/` directory).
- **Purpose:** Handles server-side logic such as Telegram Bot Webhooks and Notifications.
- **Why Vercel Functions:** Replaced Firebase Cloud Functions because the Firebase Spark plan does not support Cloud Functions. Leveraging Vercel keeps the infrastructure costs at zero for the initial tier.

### 4. Database and Authentication
- **Provider:** Firebase.
- **Database:** Firestore (NoSQL) for flexible schema storage of leads.
- **Auth:** Firebase Authentication (Email/Password, Google). User registration is restricted to manual creation via the Firebase Console to secure the CRM.

## High-Level Data Flow
1. User submits a form on a Landing Page.
2. Data is sent directly to Firestore.
3. (Optional) A trigger/webhook calls the Vercel Serverless API to send a Telegram Notification to the client.
4. The CRM React app, listening to Firestore, updates in real-time to display the new lead.
