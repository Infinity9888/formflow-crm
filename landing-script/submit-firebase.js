// submit-firebase.js
// A universal "set and forget" script to send any HTML form data to Firebase.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAH6bZBc-4FpMcamG-onxIUH4vz2cdseQg",
  authDomain: "universal-leads-test.firebaseapp.com",
  projectId: "universal-leads-test",
  storageBucket: "universal-leads-test.firebasestorage.app",
  messagingSenderId: "939621115448",
  appId: "1:939621115448:web:0b1bcda036a6289214a8cd",
  measurementId: "G-C630Y0YKHX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// TODO: Replace with your actual Vercel deployment URL once deployed
const NOTIFICATION_API_URL = "https://formflow-crm.vercel.app/api/send-notification";


document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('lead-form');
  const submitBtn = document.getElementById('submit-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Отправка...';
    }

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const urlParams = new URLSearchParams(window.location.search);
      const utm_source = urlParams.get('utm_source') || 'organic';
      const utm_medium = urlParams.get('utm_medium') || null;
      const utm_campaign = urlParams.get('utm_campaign') || null;
      const utm_term = urlParams.get('utm_term') || null;
      const utm_content = urlParams.get('utm_content') || null;

      // We extract a few generic fields if available, otherwise just dump everything into `formData`
      const payload = {
        clientId: document.body.dataset.clientId || "unknown_client", // Set <body data-client-id="...">
        status: "new",
        createdAt: serverTimestamp(),
        source: document.body.dataset.leadSource || window.location.pathname.split('/').pop() || window.location.hostname || "direct",
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        formData: data
      };

      const docRef = await addDoc(collection(db, "leads"), payload);

      // Trigger Telegram Notification (fire and forget)
      fetch(NOTIFICATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: payload.clientId,
          leadId: docRef.id
        })
      }).catch(err => console.error("Notification error:", err));

      form.reset();
      alert('Заявка успешно отправлена!');
      
    } catch (error) {
      console.error("Error adding document: ", error);
      alert('Ошибка при отправке. Пожалуйста, попробуйте позже.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Отправить';
      }
    }
  });
});
