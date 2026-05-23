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

  // Create status message element if not already in HTML
  let statusMsg = document.getElementById('form-status');
  if (!statusMsg) {
    statusMsg = document.createElement('p');
    statusMsg.id = 'form-status';
    statusMsg.style.cssText = 'margin-top:12px;text-align:center;font-weight:500;';
    form.insertAdjacentElement('afterend', statusMsg);
  }

  // Honeypot: inject hidden field — bots fill it, humans don't
  const honeypot = document.createElement('input');
  honeypot.type = 'text';
  honeypot.name = '_honeypot';
  honeypot.style.cssText = 'position:absolute;left:-9999px;opacity:0;';
  honeypot.tabIndex = -1;
  honeypot.autocomplete = 'off';
  form.appendChild(honeypot);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Отправка...';
    }

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Reject bots that filled the honeypot
      if (data['_honeypot']) return;
      delete data['_honeypot'];

      // Rate limit: max 3 submissions per hour per device
      const RATE_KEY = 'ff_submit_times';
      const now = Date.now();
      const times = JSON.parse(localStorage.getItem(RATE_KEY) || '[]').filter(t => now - t < 3600000);
      if (times.length >= 3) {
        statusMsg.style.color = '#dc2626';
        statusMsg.textContent = '❌ Забагато спроб. Спробуйте через годину.';
        return;
      }
      localStorage.setItem(RATE_KEY, JSON.stringify([...times, now]));

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
      statusMsg.style.color = '#16a34a';
      statusMsg.textContent = '✅ Заявка успешно отправлена! Ми зв\'яжемось з вами найближчим часом.';
      form.style.display = 'none';
      
    } catch (error) {
      console.error("Error adding document: ", error);
      statusMsg.style.color = '#dc2626';
      statusMsg.textContent = '❌ Помилка. Спробуйте ще раз або зателефонуйте нам.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Отправить';
      }
    }
  });
});
