/**
 * Kindred forms: receives answers from the Kindred website and saves them in this Google Sheet.
 * One tab per form (Survey, Share your story, Contact, Ideas), one column per question.
 * Answers are private to the owner of this spreadsheet.
 */

// Tabs the website is allowed to write to. Anything else is ignored.
const FORMS = ["Survey", "Share your story", "Contact", "Ideas"];

// Get an email when someone sends one of these forms. The email never contains their answers.
const NOTIFY_FOR = ["Share your story", "Contact"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.website) return reply({ ok: true }); // spam trap filled in by a bot
    if (FORMS.indexOf(body.form) === -1) return reply({ ok: false, error: "Unknown form." });
    const data = body.data || {};
    const keys = Object.keys(data);
    if (!keys.length || keys.length > 120) return reply({ ok: false, error: "Nothing to save." });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(body.form) || ss.insertSheet(body.form);
    let headers = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    if (!headers.length) headers = ["Received"];
    keys.forEach(function (k) {
      const name = String(k).slice(0, 200);
      if (headers.indexOf(name) === -1) headers.push(name);
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);

    const row = headers.map(function (h) { return h === "Received" ? new Date() : clean(data[h]); });
    sheet.appendRow(row);

    if (NOTIFY_FOR.indexOf(body.form) !== -1) notify(body.form, ss.getUrl());
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: "Could not save." });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply({ ok: true, service: "Kindred forms" });
}

function clean(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) v = v.join("; ");
  if (typeof v === "number") return v;
  v = String(v).slice(0, 12000);
  // Stop text from being run as a spreadsheet formula.
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v;
}

function notify(form, url) {
  try {
    const me = Session.getEffectiveUser().getEmail();
    if (!me) return;
    MailApp.sendEmail(me, "Kindred: new " + form + " message",
      "Someone sent the \"" + form + "\" form on the Kindred website.\n\nOpen your private sheet to read it:\n" + url +
      "\n\nFor privacy, this email does not include what they wrote.");
  } catch (e) { /* email is optional */ }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
