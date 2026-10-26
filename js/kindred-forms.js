// Kindred forms: renders the site's forms and sends answers to the organizer's private Google Sheet.
// The address below is the Google Apps Script web app that writes each answer into the sheet.
export const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbxvKsGhucI5WBaEm1sX07k4igCie1E09AlFTjHWlEBvCrNJyFTsQCQ2gGtjhCE-vpNm/exec";

/** Send one response to the Google Sheet. `form` picks the tab; `data` is { "Column name": value }. */
export async function sendToSheet(form, data) {
  if (!/^https:\/\/script\.google\.com\//.test(SHEET_ENDPOINT)) throw new Error("Form storage is not set up yet.");
  const body = JSON.stringify({ form, data, website: "" });
  try {
    const res = await fetch(SHEET_ENDPOINT, { method: "POST", body, redirect: "follow" });
    const out = await res.json().catch(() => ({ ok: res.ok }));
    if (!out.ok) throw new Error(out.error || "The form could not be sent.");
    return out;
  } catch (err) {
    if (err instanceof TypeError) {
      // Some browsers block reading the reply; the answer is still delivered.
      await fetch(SHEET_ENDPOINT, { method: "POST", body, mode: "no-cors" });
      return { ok: true };
    }
    throw err;
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let uid = 0;

/** Render a form from a plain spec into `container`, validate it, and send it to the sheet. */
export function mountForm(container, spec) {
  const id = `kf${++uid}`;
  const fieldHtml = spec.fields.map((f, i) => {
    const fid = `${id}-${i}`;
    const req = f.required ? `<span class="f-req">(required)</span>` : "";
    const help = f.description ? `<p class="f-help" id="${fid}-help">${esc(f.description)}</p>` : "";
    const err = `<p class="f-err" id="${fid}-err" role="alert"></p>`;
    const desc = `aria-describedby="${f.description ? fid + "-help " : ""}${fid}-err"`;
    const hidden = f.hidden ? " hidden" : "";
    if (f.kind === "radio" || f.kind === "multi") {
      const type = f.kind === "radio" ? "radio" : "checkbox";
      const opts = f.choices.map((c, j) => `<label class="f-opt" for="${fid}-${j}"><input type="${type}" id="${fid}-${j}" name="${fid}" value="${esc(c)}"${f.default === c ? " checked" : ""}> ${esc(c)}</label>`).join("");
      return `<div class="f-field" data-i="${i}"${hidden}><fieldset ${desc}><legend>${esc(f.label)}${req}</legend>${help}<div class="f-opts">${opts}</div></fieldset>${err}</div>`;
    }
    if (f.kind === "checkbox") {
      return `<div class="f-field" data-i="${i}"${hidden}><label class="f-opt" for="${fid}"><input type="checkbox" id="${fid}" name="${fid}" value="Yes" ${desc}> <span>${esc(f.label)}${req}</span></label>${help}${err}</div>`;
    }
    const label = `<label class="f-label" for="${fid}">${esc(f.label)}${req}</label>${help}`;
    const common = `id="${fid}" name="${fid}" class="f-input" ${desc}${f.maxLength ? ` maxlength="${f.maxLength}"` : ""}`;
    if (f.kind === "select") {
      return `<div class="f-field" data-i="${i}"${hidden}>${label}<select ${common}><option value="">Choose one</option>${f.choices.map((c) => `<option>${esc(c)}</option>`).join("")}</select>${err}</div>`;
    }
    if (f.kind === "textarea") {
      return `<div class="f-field" data-i="${i}"${hidden}>${label}<textarea ${common}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}></textarea>${err}</div>`;
    }
    return `<div class="f-field" data-i="${i}"${hidden}>${label}<input type="text" ${common}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""} autocomplete="off">${err}</div>`;
  }).join("");

  container.innerHTML = `<form novalidate>
    ${fieldHtml}
    <div style="position:absolute;left:-9999px" aria-hidden="true"><label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <p class="f-formerr" role="alert"></p>
    <div class="f-actions"><button class="button" type="submit">${esc(spec.submitText || "Send")}</button>${spec.footnote ? `<span class="f-help">${esc(spec.footnote)}</span>` : ""}</div>
  </form>`;
  const form = container.querySelector("form");
  const fieldEl = (i) => form.querySelector(`.f-field[data-i="${i}"]`);

  function value(i) {
    const f = spec.fields[i], el = fieldEl(i);
    if (f.kind === "multi") return [...el.querySelectorAll("input:checked")].map((x) => x.value);
    if (f.kind === "radio") return (el.querySelector("input:checked") || {}).value || "";
    if (f.kind === "checkbox") return el.querySelector("input").checked ? "Yes" : "";
    return el.querySelector(".f-input").value.trim();
  }
  function applyRules() {
    (spec.rules || []).forEach((r) => {
      const src = spec.fields.findIndex((f) => f.label === r.when.field);
      const show = value(src) !== r.when.isNot && value(src) !== "";
      r.show.forEach((label) => { const i = spec.fields.findIndex((f) => f.label === label); fieldEl(i).hidden = !show; });
    });
  }
  form.addEventListener("change", (e) => {
    applyRules();
    const el = e.target.closest(".f-field");
    if (el) { el.querySelector(".f-err").textContent = ""; el.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid")); }
  });
  applyRules();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formErr = form.querySelector(".f-formerr");
    formErr.textContent = "";
    let first = null;
    const data = { ...(spec.extra || {}) };
    spec.fields.forEach((f, i) => {
      const el = fieldEl(i), err = el.querySelector(".f-err"), v = value(i);
      const empty = Array.isArray(v) ? v.length === 0 : !v;
      err.textContent = "";
      el.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
      if (el.hidden) return;
      if (f.required && empty) {
        err.textContent = f.kind === "checkbox" ? "Please confirm to continue." : "This question needs an answer.";
        const ctl = el.querySelector("input, select, textarea");
        ctl.setAttribute("aria-invalid", "true");
        first = first || ctl;
      }
      data[f.label] = Array.isArray(v) ? v.join("; ") : v;
    });
    if (first) { formErr.textContent = "Please check the highlighted questions."; first.focus(); return; }
    if (form.website.value) return;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await sendToSheet(spec.sheet, data);
      container.innerHTML = `<div class="f-thanks" tabindex="-1"><h3>${esc(spec.thanksTitle || "Thank you.")}</h3>${spec.thanks ? `<p>${esc(spec.thanks)}</p>` : ""}</div>`;
      container.querySelector(".f-thanks").focus();
    } catch (err) {
      formErr.textContent = "Sorry, your message could not be sent. Please check your connection and try again.";
      btn.disabled = false; btn.textContent = spec.submitText || "Send";
    }
  });
}

/* ---------- The site's forms ---------- */
export const FORMS = {
  story: {
    sheet: "Share your story", submitText: "Send privately", footnote: "Only the site’s organizer can read this.",
    thanksTitle: "Thank you. Your message was sent.",
    thanks: "Thank you for trusting us with this. We will reach out using the way you chose. You can change your mind at any time.",
    fields: [
      { label: "How would you like to share?", kind: "multi", required: true, choices: ["In writing", "Phone conversation", "Video call", "In person", "Recorded audio or video", "Speaking at an event"] },
      { label: "What would you be comfortable talking about?", kind: "multi", description: "Only what you want. Skipping any of these is completely fine.", choices: ["How it started", "What it was like", "How I got out or found help", "Life after", "What would have helped", "Myths I want to correct"] },
      { label: "Why do you want to share?", kind: "textarea", maxLength: 3000 },
      { label: "Anything you would like to tell us now", kind: "textarea", description: "A few lines is plenty. You do not need to write your story here.", maxLength: 12000 },
      { label: "How should you be named if your story is shared?", kind: "radio", required: true, default: "Anonymous", choices: ["Anonymous", "First name only", "A name I choose", "My full name"] },
      { label: "Name to use", kind: "text", hidden: true, maxLength: 120 },
      { label: "Safest way to reach you", kind: "select", choices: ["Email", "Phone call", "Text message", "Through an advocate or case manager", "Please do not contact me"] },
      { label: "Email, number or advocate's contact", kind: "text", maxLength: 200 },
      { label: "Safe times to reach you, and is it OK to leave a message?", kind: "text", maxLength: 200, placeholder: "e.g. weekdays after 6pm, no voicemail" },
      { label: "I understand nothing will be published without my review and approval, and I can withdraw at any time.", kind: "checkbox", required: true }
    ],
    rules: [{ when: { field: "How should you be named if your story is shared?", isNot: "Anonymous" }, show: ["Name to use"] }]
  },
  contact: {
    sheet: "Contact", submitText: "Send message", thanksTitle: "Thank you. Your message was sent.",
    thanks: "We read every message and reply when we can. If you need help right now, please use the hotlines on this page.",
    fields: [
      { label: "I am", kind: "radio", required: true, choices: ["A survivor looking for support", "A family member or friend", "A professional or organization", "Someone who wants to volunteer", "A researcher or student", "A journalist or content creator"] },
      { label: "What are you looking for?", kind: "multi", choices: ["Referral to support services", "Legal help referral", "Volunteering", "Partnership or collaboration", "Speaker or training", "Research collaboration", "Networking"] },
      { label: "Name", kind: "text", maxLength: 120 },
      { label: "Organization", kind: "text", maxLength: 160 },
      { label: "How to reach you", kind: "text", required: true, maxLength: 200, placeholder: "Email or phone, and whether it is safe to leave a message" },
      { label: "Message", kind: "textarea", maxLength: 5000 }
    ]
  },
  network: {
    sheet: "Get involved", extra: { "Type": "Join the network" }, submitText: "Join the network", thanksTitle: "Welcome to the Kindred network.",
    thanks: "Thank you. We\u2019ll be in touch with resources and news of trainings and events. You can ask to be removed at any time.",
    fields: [
      { label: "First name", kind: "text", maxLength: 80 },
      { label: "Email", kind: "text", required: true, maxLength: 200, placeholder: "you@example.org" },
      { label: "Country", kind: "text", maxLength: 80 },
      { label: "Which best describes you?", kind: "select", choices: ["Member of the public", "Parent or caregiver", "Professional who may see these situations at work", "Student or researcher", "Survivor or survivor advocate", "Representing an organization"] },
      { label: "What would you like to hear about?", kind: "multi", choices: ["Learning resources", "Trainings", "Events", "Volunteering", "Partnerships"] },
      { label: "I agree that Kindred may email me. I can unsubscribe at any time.", kind: "checkbox", required: true }
    ]
  },
  training: {
    sheet: "Get involved", extra: { "Type": "Training request" }, submitText: "Send request", thanksTitle: "Thank you. Your request was sent.",
    thanks: "We\u2019ll get back to you to talk about what your group needs.",
    fields: [
      { label: "Organization or group", kind: "text", required: true, maxLength: 160 },
      { label: "Type of group", kind: "select", required: true, choices: ["Workplace", "School or college", "Faith community", "Community group", "Bank or financial services", "Healthcare", "Hotel, transport or hospitality", "Other"] },
      { label: "Your name", kind: "text", required: true, maxLength: 120 },
      { label: "Email or phone", kind: "text", required: true, maxLength: 200 },
      { label: "City and country", kind: "text", maxLength: 120 },
      { label: "About how many people?", kind: "select", choices: ["Under 15", "15 to 50", "50 to 150", "More than 150"] },
      { label: "Topics of interest", kind: "multi", choices: ["Recognizing human trafficking", "Scams and older adults", "Keeping children safe online", "How to respond and where to report"] },
      { label: "Preferred format", kind: "radio", choices: ["In person", "Online", "Either"] },
      { label: "Anything else we should know?", kind: "textarea", maxLength: 2000 }
    ]
  },
  idea: {
    sheet: "Ideas", submitText: "Send idea", thanksTitle: "Thank you for your idea.",
    thanks: "Ideas are read by the organizer, and some are shared on the site.",
    fields: [
      { label: "Your idea, in one line", kind: "text", required: true, maxLength: 140, placeholder: "e.g. Hotline cards in every rest stop restroom" },
      { label: "Category", kind: "select", required: true, choices: ["Awareness and education", "Prevention", "Survivor support", "Policy and advocacy", "Research and data", "Events and fundraising"] },
      { label: "Details", kind: "textarea", maxLength: 3000, placeholder: "Who it would reach, what it would take, why it would work." },
      { label: "Your name, if we share your idea", kind: "text", maxLength: 80 }
    ]
  }
};
