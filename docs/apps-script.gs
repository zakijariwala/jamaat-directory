/**
 * Jamaat Directory — Google Apps Script: transform + push.
 *
 * ARCHITECTURE (see handover §9 "alternative approach")
 *   Form Responses 1  (raw, wide, branchy — NEVER edited by this script)
 *        │  handleFormSubmit  (installable "On form submit" trigger)
 *        ▼
 *   Cities / Contacts / Facilities   (clean, normalized moderation tabs)
 *        │  handleEdit  (installable "On edit" trigger) — or auto right after transform
 *        ▼
 *   POST (HMAC-SHA256) → /api/ingest → D1 → /directory.json
 *
 * MODERATION (owner's choice): a contact whose submitter gave their own details
 * or explicit consent is auto-published (status "live"); every other contact is
 * "pending" until a moderator sets it live. Facilities are published on submit
 * (set a row's Status to "pending" or "removed" to hide it). The server AND the
 * snapshot re-check consent, so a mis-set status can never leak an unconsented
 * phone.
 *
 * SETUP (once)
 *   1. Open the responses spreadsheet → Extensions → Apps Script.
 *   2. Replace the default Code.gs with this whole file. Save.
 *   3. Project Settings → Script properties, add:
 *        INGEST_URL    = https://jamaat-directory.pages.dev/api/ingest
 *        INGEST_SECRET = <the value set via `wrangler pages secret put INGEST_SECRET`>
 *   4. Run `setup` once (Run ▸ setup). Authorize the scopes it asks for
 *      (Spreadsheet + External requests). This creates the three clean tabs.
 *   5. Triggers (clock icon → Add trigger) — BOTH must be INSTALLABLE, because
 *      simple triggers cannot call UrlFetchApp:
 *        • Function handleFormSubmit → event: From spreadsheet, On form submit
 *        • Function handleEdit       → event: From spreadsheet, On edit
 *   6. Backfill existing responses (optional): Run ▸ backfillAll.
 *
 * The clean tabs contain phone numbers — that is fine, they are the private
 * moderation surface. Phones are stripped by buildSnapshot before anything is
 * ever public.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

var RESPONSES_TAB = 'Form Responses 1'; // rename here if your responses tab differs
var CITIES_TAB = 'Cities';
var CONTACTS_TAB = 'Contacts';
var FACILITIES_TAB = 'Facilities';

var CITY_HEADERS = ['id', 'name', 'jamaat_name', 'state', 'country', 'aliases', 'region',
  'nearest_rail', 'nearest_air', 'notes', 'updated_at', 'submission_ts'];
var CONTACT_HEADERS = ['id', 'city_id', 'name', 'phone', 'whatsapp', 'role',
  'helps_with', 'best_time', 'languages', 'self_added', 'consent', 'status',
  'verified_at', 'created_at', 'submission_ts'];
var FACILITY_HEADERS = ['id', 'city_id', 'kind', 'name', 'address', 'maps_url',
  'phone', 'timings', 'charges_band', 'booking_note', 'facilities', 'status',
  'verified_at', 'created_at', 'submission_ts'];

// Indian state (lowercased) → region. Unknown states leave region blank for a
// moderator to fill.
var STATE_REGION = {
  'jammu and kashmir': 'north', 'ladakh': 'north', 'himachal pradesh': 'north',
  'punjab': 'north', 'haryana': 'north', 'uttarakhand': 'north',
  'uttar pradesh': 'north', 'delhi': 'north', 'chandigarh': 'north',
  'rajasthan': 'north',
  'bihar': 'east', 'jharkhand': 'east', 'west bengal': 'east', 'odisha': 'east',
  'assam': 'east', 'sikkim': 'east', 'arunachal pradesh': 'east',
  'nagaland': 'east', 'manipur': 'east', 'mizoram': 'east', 'tripura': 'east',
  'meghalaya': 'east',
  'gujarat': 'west', 'maharashtra': 'west', 'goa': 'west',
  'dadra and nagar haveli and daman and diu': 'west',
  'karnataka': 'south', 'kerala': 'south', 'tamil nadu': 'south',
  'andhra pradesh': 'south', 'telangana': 'south', 'puducherry': 'south',
  'madhya pradesh': 'central', 'chhattisgarh': 'central',
};

// ---------------------------------------------------------------------------
// Trigger entry points (must be attached as INSTALLABLE triggers)
// ---------------------------------------------------------------------------

function handleFormSubmit(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var responses = ss.getSheetByName(RESPONSES_TAB) || e.range.getSheet();
  var headers = responses.getRange(1, 1, 1, responses.getLastColumn()).getValues()[0];
  var rowNum = e.range ? e.range.getRow() : responses.getLastRow();
  var values = responses.getRange(rowNum, 1, 1, responses.getLastColumn()).getValues()[0];
  var cityId = transformRow_(headers, values);
  if (cityId) pushCity_(cityId);
}

function handleEdit(e) {
  var sheet = e.range.getSheet();
  var name = sheet.getName();
  if (name !== CONTACTS_TAB && name !== FACILITIES_TAB && name !== CITIES_TAB) return;
  if (e.range.getRow() <= 1) return; // header
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = sheet.getRange(e.range.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
  var obj = rowToObject_(headers, row);
  var cityId = (name === CITIES_TAB) ? obj.id : obj.city_id;
  if (cityId) pushCity_(cityId);
}

// ---------------------------------------------------------------------------
// Menu helpers (Run these manually)
// ---------------------------------------------------------------------------

function setup() { ensureTabs_(); }

function backfillAll() {
  ensureTabs_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var responses = ss.getSheetByName(RESPONSES_TAB);
  if (!responses) throw new Error('Responses tab "' + RESPONSES_TAB + '" not found');
  var last = responses.getLastRow();
  if (last < 2) return;
  var headers = responses.getRange(1, 1, 1, responses.getLastColumn()).getValues()[0];
  var data = responses.getRange(2, 1, last - 1, responses.getLastColumn()).getValues();
  var cityIds = {};
  for (var i = 0; i < data.length; i++) {
    var id = transformRow_(headers, data[i]);
    if (id) cityIds[id] = true;
  }
  for (var id2 in cityIds) pushCity_(id2);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Directory')
    .addItem('Create clean tabs', 'setup')
    .addItem('Backfill all responses', 'backfillAll')
    .addToUi();
}

// ---------------------------------------------------------------------------
// Transform: one raw response row → normalized rows in the clean tabs
// Returns the affected cityId (or '' if the row had no usable city).
// ---------------------------------------------------------------------------

function transformRow_(headers, values) {
  var idx = buildIndex_(headers);
  var g = function (name) { return firstNonEmpty_(values, idx[name]); };

  var cityName = String(g('City or town')).trim();
  if (!cityName) return '';
  var cityId = slug_(cityName);
  var stamp = g('Timestamp');
  var nowIso = stamp ? new Date(stamp).toISOString() : new Date().toISOString();

  // --- City ---
  var busStand = String(g('Nearest bus stand')).trim();
  var extra = String(g('Anything else we should know?')).trim();
  var notes = [busStand ? ('Nearest bus stand: ' + busStand) : '', extra]
    .filter(String).join(' — ') || '';
  var city = {
    id: cityId,
    name: cityName,
    jamaat_name: String(g('Jamaat name')).trim(),
    state: String(g('State')).trim(),
    // Form has no Country question yet; default to India so a re-push never
    // nulls an existing city's country. Drop the default when the form adds it.
    country: String(g('Country')).trim() || 'India',
    aliases: '[]',
    region: STATE_REGION[String(g('State')).trim().toLowerCase()] || '',
    nearest_rail: String(g('Nearest railway station')).trim(),
    nearest_air: String(g('Nearest airport')).trim(),
    notes: notes,
    updated_at: nowIso,
    submission_ts: nowIso,
  };
  upsertRow_(CITIES_TAB, CITY_HEADERS, city);

  // --- Contacts ---
  var contacts = [];
  // Early single-contact branch ("A contact person")
  pushContact_(contacts, cityId, nowIso, {
    name: g('Full name'), phone: g('Phone number'),
    whatsapp: g('Is this number on WhatsApp?'), role: g('Role or position'),
    helps: g('What can they help with?'), best: g('Best time to call'),
    langs: g('Languages spoken'),
    permission: g('Whose details are these?') || g('Permission'),
  });
  // Full-city branch: Contact 1..3
  for (var n = 1; n <= 3; n++) {
    var p = 'Contact ' + n + ' — ';
    pushContact_(contacts, cityId, nowIso, {
      name: g(p + 'Full name'), phone: g(p + 'Phone number'),
      whatsapp: g(p + 'Is this number on WhatsApp?'), role: g(p + 'Role or position'),
      helps: g(p + 'What can they help with?'), best: g(p + 'Best time to call'),
      langs: g(p + 'Languages spoken'), permission: g(p + 'permission'),
    });
  }
  for (var c = 0; c < contacts.length; c++) upsertRow_(CONTACTS_TAB, CONTACT_HEADERS, contacts[c]);

  // --- Facilities ---
  var facs = [];
  // Masjids: early bare block + Masjid 1..2
  addMasjid_(facs, cityId, nowIso, {
    name: g('Name'), address: g('Address'), maps: g('Google Maps link'),
    timings: g('Namaz timings'), fac: g('Facilities'), phone: g('Masjid contact number'),
  });
  for (var m = 1; m <= 2; m++) {
    var mp = 'Masjid ' + m + ' — ';
    addMasjid_(facs, cityId, nowIso, {
      name: g(mp + 'Name'), address: g(mp + 'Address'), maps: g(mp + 'Google Maps link'),
      timings: g(mp + 'Namaz timings'), fac: g(mp + 'Facilities'),
      phone: g(mp + 'Masjid contact number'),
    });
  }
  // Musafir khana (headers identical in both branches → coalesced by firstNonEmpty)
  addMusafir_(facs, cityId, nowIso, {
    name: g('Musafir khana — name'), address: g('Musafir khana — address'),
    maps: g('Musafir khana — Google Maps link'),
    phone: g('Musafir khana — booking contact number'),
    rooms: g('Musafir khana — approximate rooms or capacity'),
    charges: g('Musafir khana — charges'), book: g('Musafir khana — how to book'),
  });
  // Hotels 1..5 (early set has 5, full-city set has 3; duplicate headers coalesce)
  for (var h = 1; h <= 5; h++) {
    var hp = 'Hotel ' + h + ' — ';
    addHotel_(facs, cityId, nowIso, {
      name: g(hp + 'Name'), maps: g(hp + 'Google Maps link'),
      price: g(hp + 'Price band'), halal: g(hp + 'Halal food available nearby?'),
      distance: g(hp + 'Distance from the masjid'),
    });
  }
  // Restaurants 1..5
  for (var r = 1; r <= 5; r++) {
    var rp = 'Restaurant ' + r + ' — ';
    addRestaurant_(facs, cityId, nowIso, {
      name: g(rp + 'Name'), address: g(rp + 'Address or location'),
      maps: g(rp + 'Google Maps link'), price: g(rp + 'Price band'),
      halal: g(rp + 'Halal status'), cuisine: g(rp + 'Cuisine or type'),
    });
  }
  for (var f = 0; f < facs.length; f++) upsertRow_(FACILITIES_TAB, FACILITY_HEADERS, facs[f]);

  return cityId;
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

function pushContact_(out, cityId, nowIso, r) {
  var name = String(r.name || '').trim();
  var phone = String(r.phone || '').trim();
  if (!name || !phone) return;
  var consent = parseConsent_(r.permission);
  var live = consent.self_added === 1 || consent.consent === 1;
  out.push({
    id: 'c-' + cityId + '-' + slug_(name) + '-' + last4_(phone),
    city_id: cityId,
    name: name,
    phone: normPhone_(phone),
    whatsapp: yesish_(r.whatsapp),
    role: String(r.role || '').trim(),
    helps_with: String(r.helps || '').trim(),
    best_time: String(r.best || '').trim(),
    languages: String(r.langs || '').trim(),
    self_added: consent.self_added,
    consent: consent.consent,
    status: live ? 'live' : 'pending',
    verified_at: nowIso,
    created_at: nowIso,
    submission_ts: nowIso,
  });
}

function addMasjid_(out, cityId, nowIso, r) {
  var name = String(r.name || '').trim();
  if (!name) return;
  out.push(facRow_(cityId, nowIso, 'masjid', {
    name: name, address: r.address, maps_url: r.maps, phone: r.phone,
    timings: r.timings, charges_band: '', booking_note: '',
    facilities: chips_(r.fac),
  }));
}

function addMusafir_(out, cityId, nowIso, r) {
  var name = String(r.name || '').trim();
  if (!name) return;
  var booking = [String(r.rooms || '').trim() ? ('Rooms/capacity: ' + r.rooms) : '',
    String(r.book || '').trim() ? ('How to book: ' + r.book) : ''].filter(String).join(' — ');
  out.push(facRow_(cityId, nowIso, 'musafir_khana', {
    name: name, address: r.address, maps_url: r.maps, phone: r.phone,
    timings: '', charges_band: parseCharges_(r.charges), booking_note: booking,
    facilities: '[]',
  }));
}

function addHotel_(out, cityId, nowIso, r) {
  var name = String(r.name || '').trim();
  if (!name) return;
  var chips = [];
  if (yesish_(r.halal)) chips.push('halal food nearby');
  if (String(r.price || '').trim()) chips.push(String(r.price).trim());
  if (String(r.distance || '').trim()) chips.push(String(r.distance).trim() + ' from masjid');
  out.push(facRow_(cityId, nowIso, 'hotel', {
    name: name, address: '', maps_url: r.maps, phone: '',
    timings: '', charges_band: '', booking_note: '',
    facilities: JSON.stringify(chips),
  }));
}

function addRestaurant_(out, cityId, nowIso, r) {
  var name = String(r.name || '').trim();
  if (!name) return;
  var chips = [];
  if (String(r.halal || '').trim()) chips.push(String(r.halal).trim());
  if (String(r.cuisine || '').trim()) chips.push(String(r.cuisine).trim());
  if (String(r.price || '').trim()) chips.push(String(r.price).trim());
  out.push(facRow_(cityId, nowIso, 'restaurant', {
    name: name, address: r.address, maps_url: r.maps, phone: '',
    timings: '', charges_band: '', booking_note: '',
    facilities: JSON.stringify(chips),
  }));
}

function facRow_(cityId, nowIso, kind, r) {
  return {
    id: 'f-' + cityId + '-' + kind + '-' + slug_(r.name),
    city_id: cityId, kind: kind, name: r.name,
    address: String(r.address || '').trim(), maps_url: String(r.maps_url || '').trim(),
    phone: normPhone_(r.phone), timings: String(r.timings || '').trim(),
    charges_band: r.charges_band || '', booking_note: r.booking_note || '',
    facilities: r.facilities || '[]',
    status: 'live', verified_at: nowIso, created_at: nowIso, submission_ts: nowIso,
  };
}

// ---------------------------------------------------------------------------
// Push a city (its city row + all its contacts + all its facilities) to D1.
// Sends every row with its current Status; the snapshot shows only "live".
// ---------------------------------------------------------------------------

function pushCity_(cityId) {
  var city = findById_(CITIES_TAB, CITY_HEADERS, 'id', cityId);
  if (!city) return;
  var contacts = findAllBy_(CONTACTS_TAB, CONTACT_HEADERS, 'city_id', cityId);
  var facilities = findAllBy_(FACILITIES_TAB, FACILITY_HEADERS, 'city_id', cityId);

  var payload = {
    submission_id: cityId + ':' + Date.now(),
    city: {
      id: city.id, name: city.name, jamaat_name: city.jamaat_name,
      state: emptyToNull_(city.state), country: emptyToNull_(city.country),
      aliases: city.aliases || '[]',
      region: emptyToNull_(city.region), nearest_rail: emptyToNull_(city.nearest_rail),
      nearest_air: emptyToNull_(city.nearest_air), notes: emptyToNull_(city.notes),
      updated_at: city.updated_at,
    },
    contacts: contacts.map(function (c) {
      return {
        id: c.id, city_id: c.city_id, name: c.name, phone: c.phone,
        whatsapp: toInt_(c.whatsapp), role: emptyToNull_(c.role),
        helps_with: emptyToNull_(c.helps_with), best_time: emptyToNull_(c.best_time),
        languages: emptyToNull_(c.languages), self_added: toInt_(c.self_added),
        consent: toInt_(c.consent), status: c.status || 'pending',
        verified_at: emptyToNull_(c.verified_at), created_at: c.created_at,
      };
    }),
    facilities: facilities.map(function (f) {
      return {
        id: f.id, city_id: f.city_id, kind: f.kind, name: f.name,
        address: emptyToNull_(f.address), maps_url: emptyToNull_(f.maps_url),
        phone: emptyToNull_(f.phone), timings: emptyToNull_(f.timings),
        charges_band: emptyToNull_(f.charges_band), booking_note: emptyToNull_(f.booking_note),
        facilities: f.facilities || '[]', status: f.status || 'pending',
        verified_at: emptyToNull_(f.verified_at), created_at: f.created_at,
      };
    }),
  };
  post_(payload);
}

function post_(payload) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('INGEST_URL');
  var secret = props.getProperty('INGEST_SECRET');
  if (!url || !secret) throw new Error('Set INGEST_URL and INGEST_SECRET in Script properties');
  var body = JSON.stringify(payload);
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', payload: body,
    headers: { 'X-Signature': sign_(secret, body) }, muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('ingest ' + code + ': ' + res.getContentText());
}

function sign_(secret, message) {
  var raw = Utilities.computeHmacSha256Signature(message, secret);
  return raw.map(function (b) {
    var v = (b < 0) ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

function ensureTabs_() {
  ensureTab_(CITIES_TAB, CITY_HEADERS);
  ensureTab_(CONTACTS_TAB, CONTACT_HEADERS);
  ensureTab_(FACILITIES_TAB, FACILITY_HEADERS);
}

function ensureTab_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var have = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  if (String(have.join('|')) !== String(headers.join('|'))) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertRow_(tabName, headers, obj) {
  var sheet = ensureTab_(tabName, headers);
  var idCol = headers.indexOf('id');
  var last = sheet.getLastRow();
  var ids = last > 1 ? sheet.getRange(2, idCol + 1, last - 1, 1).getValues() : [];
  var target = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(obj.id)) { target = i + 2; break; }
  }
  var row = headers.map(function (h) { return obj[h] === undefined ? '' : obj[h]; });
  if (target === -1) sheet.appendRow(row);
  else {
    // Preserve a moderator-edited Status on re-transform of the same id.
    if (headers.indexOf('status') !== -1) {
      var existing = sheet.getRange(target, 1, 1, headers.length).getValues()[0];
      var sIdx = headers.indexOf('status');
      if (existing[sIdx]) row[sIdx] = existing[sIdx];
    }
    sheet.getRange(target, 1, 1, headers.length).setValues([row]);
  }
}

function findById_(tabName, headers, keyCol, keyVal) {
  var rows = findAllBy_(tabName, headers, keyCol, keyVal);
  return rows.length ? rows[0] : null;
}

function findAllBy_(tabName, headers, keyCol, keyVal) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  var out = [];
  var col = headers.indexOf(keyCol);
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][col]) === String(keyVal)) out.push(rowToObject_(headers, data[i]));
  }
  return out;
}

function rowToObject_(headers, row) {
  var o = {};
  for (var i = 0; i < headers.length; i++) o[headers[i]] = row[i];
  return o;
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

function buildIndex_(headers) {
  var m = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (!m[h]) m[h] = [];
    m[h].push(i);
  }
  return m;
}

function firstNonEmpty_(values, idxList) {
  if (!idxList) return '';
  for (var k = 0; k < idxList.length; k++) {
    var v = values[idxList[k]];
    if (v !== '' && v !== null && v !== undefined) return v;
  }
  return '';
}

function parseConsent_(raw) {
  var s = String(raw || '').toLowerCase();
  if (s.indexOf('own details') !== -1) return { self_added: 1, consent: 1 };
  if (s.indexOf('permission to share') !== -1 || s.indexOf('i have') !== -1) {
    return { self_added: 0, consent: 1 };
  }
  return { self_added: 0, consent: 0 };
}

function parseCharges_(raw) {
  var s = String(raw || '').toLowerCase();
  if (!s) return '';
  if (s.indexOf('free') !== -1 || s.indexOf('no charge') !== -1) return 'free';
  if (s.indexOf('donation') !== -1) return 'donation';
  return 'paid';
}

function chips_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '[]';
  var parts = s.split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(String);
  return JSON.stringify(parts);
}

function slug_(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

function last4_(phone) {
  var d = String(phone || '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : (d || '0000');
}

function normPhone_(phone) {
  return String(phone || '').trim();
}

function yesish_(v) {
  return /^(y|true|1)/i.test(String(v || '').trim()) ? 1 : 0;
}

function toInt_(v) { return (v === 1 || v === '1' || v === true) ? 1 : 0; }

function emptyToNull_(v) {
  var s = (v === null || v === undefined) ? '' : String(v).trim();
  return s === '' ? null : s;
}
