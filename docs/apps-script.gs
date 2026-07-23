/**
 * Jamaat Directory — Google Apps Script intake trigger.
 *
 * Paste this into the response Sheet's Apps Script editor
 * (Extensions → Apps Script). It signs each approved row with HMAC-SHA256 and
 * POSTs it to the Worker's /api/ingest endpoint. No Sheets API credentials live
 * on the server — this is push, not poll.
 *
 * SETUP
 *  1. Script Properties (Project Settings → Script properties):
 *       INGEST_URL     = https://<your-pages-domain>/api/ingest
 *       INGEST_SECRET  = <same value as `wrangler pages secret put INGEST_SECRET`>
 *  2. Triggers (clock icon → Add trigger):
 *       onFormSubmit  → From spreadsheet → On form submit
 *       onEditRow     → From spreadsheet → On edit
 *  3. Adjust COLS below to match your sheet's header names.
 *
 * A row is only published when its Status column reads "live" AND (for a
 * contact) consent is TRUE or it was self-added — the Worker re-checks this, so
 * a mis-tick can never leak an unconsented number.
 */

// Column header -> meaning. Edit the right-hand strings to your actual headers.
var COLS = {
  submissionId: 'Timestamp',      // any per-row unique value
  cityId: 'City ID',              // slug, e.g. "sangli"
  cityName: 'City',
  jamaatName: 'Jamaat',
  state: 'State',
  aliases: 'Aliases',             // comma-separated; becomes a JSON array
  region: 'Region',
  nearestRail: 'Nearest Rail',
  nearestAir: 'Nearest Air',
  notes: 'Notes',
  // contact
  contactName: 'Contact Name',
  phone: 'Phone',
  whatsapp: 'WhatsApp',           // TRUE/FALSE
  role: 'Role',
  helpsWith: 'Helps With',
  bestTime: 'Best Time',
  languages: 'Languages',
  selfAdded: 'Self Added',        // TRUE/FALSE
  consent: 'Consent',             // TRUE/FALSE (required if not self-added)
  status: 'Status',               // pending | live | flagged | removed
  verifiedAt: 'Verified At',
};

function onFormSubmit(e) { handleRow_(e.range.getRow()); }
function onEditRow(e)    { handleRow_(e.range.getRow()); }

function handleRow_(rowNum) {
  if (rowNum <= 1) return; // header
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = {};
  for (var i = 0; i < headers.length; i++) row[headers[i]] = values[i];

  var cityId = String(row[COLS.cityId] || '').trim();
  if (!cityId) return;

  var iso = function (v) { return v ? new Date(v).toISOString() : null; };
  var bool = function (v) { return (v === true || String(v).toUpperCase() === 'TRUE') ? 1 : 0; };
  var list = function (v) {
    return JSON.stringify(String(v || '').split(',').map(function (s) { return s.trim(); }).filter(String));
  };
  var now = new Date().toISOString();

  var payload = {
    submission_id: String(row[COLS.submissionId] || (cityId + ':' + rowNum)),
    city: {
      id: cityId,
      name: row[COLS.cityName] || '',
      jamaat_name: row[COLS.jamaatName] || '',
      state: row[COLS.state] || null,
      aliases: list(row[COLS.aliases]),
      region: row[COLS.region] || null,
      nearest_rail: row[COLS.nearestRail] || null,
      nearest_air: row[COLS.nearestAir] || null,
      notes: row[COLS.notes] || null,
      updated_at: now,
    },
    contacts: [],
  };

  if (row[COLS.contactName] && row[COLS.phone]) {
    payload.contacts.push({
      id: 'c-' + cityId + '-' + rowNum,
      city_id: cityId,
      name: row[COLS.contactName],
      phone: String(row[COLS.phone]),
      whatsapp: bool(row[COLS.whatsapp]),
      role: row[COLS.role] || null,
      helps_with: row[COLS.helpsWith] || null,
      best_time: row[COLS.bestTime] || null,
      languages: row[COLS.languages] || null,
      self_added: bool(row[COLS.selfAdded]),
      consent: bool(row[COLS.consent]),
      status: String(row[COLS.status] || 'pending').toLowerCase(),
      verified_at: iso(row[COLS.verifiedAt]),
      created_at: now,
    });
  }

  post_(payload);
}

function post_(payload) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('INGEST_URL');
  var secret = props.getProperty('INGEST_SECRET');
  var body = JSON.stringify(payload);
  var signature = sign_(secret, body);

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: body,
    headers: { 'X-Signature': signature },
    muteHttpExceptions: true,
  });
}

function sign_(secret, message) {
  var raw = Utilities.computeHmacSha256Signature(message, secret);
  return raw.map(function (b) {
    var v = (b < 0) ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}
