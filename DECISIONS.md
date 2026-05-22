# Architecture Decisions Record (ADR)

## 2. Official Project Name: FormFlow
**Date:** 2026-05-22
**Status:** Accepted

### Context
We needed a catchy and definitive name for the "Universal Lead System" / "Landing + CRM in a pocket" productized service.

### Decision
The product name **FormFlow** has been officially chosen for the project.

### Consequences
- **Positive:** Gives the product a unified, professional brand identity.
- **Positive:** Simplifies communication with clients and marketing materials.


## 1. Pivot to Vercel Serverless Functions for Backend Logic
**Date:** 2026-05-22
**Status:** Accepted

### Context
We need to handle backend logic such as Telegram Bot Webhooks and system notifications. Initially, the plan was to use Firebase Cloud Functions for this backend logic alongside our Firebase Firestore database and Authentication.

### Problem
The Firebase Spark (free) plan does not support Firebase Cloud Functions. Upgrading to a paid plan is not desirable for the initial phase of this productized service.

### Decision
We are pivoting from Firebase Cloud Functions to Vercel Serverless Functions (located in the `api/` directory). Since the React CRM admin panel is already planned for deployment on Vercel, we can seamlessly host our serverless API endpoints there. 

### Consequences
- **Positive:** We can stay on free tiers for both Firebase (Auth/Firestore) and Vercel (Hosting/Serverless Functions).
- **Positive:** Colocates backend code with the frontend React CRM repository under the `api/` directory.
- **Negative:** Split infrastructure (Firebase for data/auth, Vercel for backend execution).
