# Gemini prompts: collecting pilot data, phase by phase

Use these in the Gemini app with **Google Maps** connected (or any Gemini with
Google Search / Maps grounding). Run one phase at a time, check the output,
then go to the next. Each phase ends in a CSV that the importer reads
directly (`npm run import:listings`, see `data/README.md`).

**Rules that apply to every phase:**

- Gemini **finds** the data. A person **checks** it before it goes live. Every
  imported row lands as *pending* and is approved in `/moderate`.
- **No people.** Never collect representatives' or individuals' names or
  personal mobile numbers. People need to give permission, so they come in
  through `/contribute`. Business and office numbers listed publicly on Google
  Maps or an official website are fine.
- **Blank beats guessed.** Tell Gemini to leave a cell empty rather than invent
  it, and to give a source link for every row.
- **Spell each city exactly the same in every phase** (e.g. always
  "Vadodara", never "Baroda" in one file). The city name is how rows from
  different phases join up; put old names in the `aliases` column in Phase 2.
- Save each CSV as `data/imports/phase-N-<what>.csv`. That folder is not
  uploaded to GitHub.

---

## Phase 1: Find the jamaats and pick the 15 cities

> **Done once already (3 Oct 2026).** The checked long-list is
> `data/reference/india-jamaats-khojapedia.csv` (65 jamaats from the India
> Federation list on KhojaPedia). Gemini's own attempt padded North and East
> with unsupported rows, so prefer the reference list and use Gemini only to
> estimate jamaat sizes for it.

Goal: a long list of Khoja Shia Ithna Ashari jamaats in India, so **you** can
pick 15 pilot cities: **5 states (one per region: North, South, East, West,
Central) × 3 jamaat sizes**, mixing complete, partial and sparse cities.

```text
You are helping build a travel directory for the Khoja Shia Ithna Ashari
community in India. I need a list of Khoja Shia Ithna Ashari jamaats
(community organisations), including the smaller ones, grouped by Indian state.

Rules:
- Only include a jamaat if you can point to a source: Google Maps listing,
  the jamaat's own website or social page, a federation/community directory,
  or a news article. Give the source URL for every row.
- Do NOT invent jamaats. If you are unsure whether a place has a Khoja Shia
  jamaat (as opposed to another Shia or Muslim community), still list it but
  put "unsure" in the confidence column.
- Estimate jamaat size as: large (big community, office, several
  institutions), medium (one jamaat, a masjid/imambargah), small (few families).
  This is about the JAMAAT's size, not the city's population. Say "unknown"
  if there's no evidence.
- Cover all five regions: North, South, East, West, Central. For each
  region, try to find at least one large, one medium and one small jamaat.

Output ONE CSV in a code block with exactly these columns:
region,state,city,jamaat_name,size,confidence,source_url,notes

confidence = confirmed | likely | unsure
```

**Then you decide:** choose 15 cities from the list: one state per region,
and in each state a large, a medium and a small jamaat. Aim for roughly 5
cities that will be complete, 5 partial and 5 sparse. Write the 15 into
`docs/PROGRESS.md` (the "Pilot cities" table).

---

## Phase 2: Jamaat details (one row per pilot city)

Goal: the city's own row: jamaat name, nearest station and airport, old city
names, the **jamaat office number** if it is publicly listed, and a size
estimate so you can set each city's target (complete / partial / sparse).
The 15 cities are already filled in from `data/reference/pilot-cities.csv`.

```text
For each of these Khoja Shia Ithna Ashari (KSI) jamaats in India, find the
details below. All of them are on the Council of All KSI Jamaats (India
Federation) list, so they exist; your job is to find their details.

city | state | jamaat
Bhavnagar | Gujarat | KSIJ of Bhavnagar
Ahmedabad | Gujarat | Kalupur Jamaat & Sarkhej Jamaat (two jamaats; give details for both in one row, notes says which is which)
Vadodara | Gujarat | Baroda Jamaat
Jamnagar | Gujarat | Jamnagar Jamaat
Una | Gujarat | Una Jamaat
Pithalpur | Gujarat | Pithalpur Jamaat (village near Talaja, Bhavnagar district)
Mumbai | Maharashtra | KSIJ of Mumbai
Pune | Maharashtra | Khoja Shia Isna Ashari Jamaat of Pune
Nagpur | Maharashtra | Nagpur Jamaat
Sangli | Maharashtra | Masjid-e-Ali Ibne Abu Talib - Sangli Jamaat
Chandrapur | Maharashtra | KSIJ Chandrapur
Hinganghat | Maharashtra | Khoja Shia Isna Ashri Jamaat Hinganghat
Bengaluru | Karnataka | KSIJ Bangalore
Hyderabad | Telangana | Khoja Shia Isna Ashri Jamaat Hyderabad
Raipur | Chhattisgarh | KSIJ Raipur

For each jamaat find:
- The jamaat's full official name (keep the name above if you find nothing better).
- Nearest railway station, written as "Station Name (CODE)", e.g. "Pune Junction (PUNE)".
- Nearest airport, written as "City (IATA)", e.g. "Pune (PNQ)". If the nearest
  airport is in another city, name that one.
- Old or alternative city names people still search for (e.g. Bombay, Poona,
  Baroda, Bangalore), separated by ";". Leave empty if none.
- The jamaat OFFICE phone number, ONLY if it is publicly listed on the
  jamaat's Google Maps listing or official website. Never a person's mobile.
  Leave empty if not found.
- size_estimate: large (big community, office, several institutions),
  medium (one jamaat with a masjid/imambargah), small (few families),
  or unknown. size_evidence: one short reason.
- A source URL for the phone number (or for the jamaat if there's no phone).

Do not guess. Leave a cell empty if you cannot find it. Keep the city names
spelled exactly as in the list above.

Output ONE CSV in a code block with exactly these columns:
kind,name,city,state,nearest_rail,nearest_air,aliases,phone,size_estimate,size_evidence,notes,source

Set kind to "jamaat" on every row. name = the jamaat's full name.
notes = anything a traveller should know about reaching the jamaat (optional,
one short sentence, public).
```

**Import only after the go-live steps** (`docs/PROGRESS.md`): until the live
database is cleared and redeployed, the sample Pune, Sangli, Bengaluru and
Hyderabad are still live, and the importer skips `jamaat` rows for cities that
already exist.

The importer ignores `size_estimate` and `size_evidence`; copy them into the
pilot table in `docs/PROGRESS.md` and set each city's target there.

Save as `data/imports/phase-2-jamaats.csv`, then:

```bash
npm run import:listings -- data/imports/phase-2-jamaats.csv
```

---

## Phase 3: Masjids, imambargahs and musafir khanas (Google Maps)

Goal: places of worship and community stays for each pilot city.

```text
Using Google Maps, for each city below find:
1. Shia masjids, imambargahs / imambadas and husainiyas, especially those
   run by or used by the Khoja Shia Ithna Ashari jamaat.
2. Musafir khanas (community guest houses) run by the jamaat or a Shia trust.

Cities:
<paste city, state for your 15 cities>

Rules:
- Only places that exist on Google Maps. maps_url must be the place's real
  Google Maps link (https://maps.app.goo.gl/... or https://www.google.com/maps/...).
- Skip places marked "Permanently closed".
- phone = the number shown on the Google Maps listing only. Leave empty if none.
- timings = opening hours or prayer/majlis timings if listed, else empty.
- charges (musafir khanas only) = free, donation or paid if stated, else empty.
- features = any of: Wuzu; Ladies' section; Parking; Ziyarat; Wheelchair
  access; Langar or food. Only if shown in photos/reviews/description.
- Do not invent places. If a city has none, write nothing for it and tell me
  which cities had none after the CSV.

Output ONE CSV in a code block with exactly these columns:
kind,name,city,state,address,maps_url,phone,timings,charges,features,source

kind = masjid (for masjids, imambargahs, husainiyas) or musafir_khana.
source = "Google Maps".
```

Save as `data/imports/phase-3-masjids-stays.csv`, then:

```bash
npm run import:listings -- data/imports/phase-3-masjids-stays.csv
```

---

## Phase 4: Halal restaurants and hotels (Google Maps)

Goal: practical places to eat and stay near each jamaat. Run it once for
restaurants and once for hotels if the output gets long.

```text
Using Google Maps, for each city below find halal restaurants and hotels
useful to a Shia Muslim traveller, as close as possible to the jamaat or its
masjid/imambargah.

Cities (with the jamaat's area if known):
<paste city, state, area>

Restaurants: up to 5 per city.
- Prefer places that say halal on their listing or menu, are well-known
  Muslim-run eateries, or are repeatedly described as halal in reviews.
- halal = "Strictly Halal" (explicitly halal / Muslim-run, halal-only),
  "Halal options available" (some halal dishes), or "Not sure".
- Rating 4.0+ and at least 50 reviews where possible.

Hotels: up to 3 per city.
- Clean, reasonably priced hotels near the jamaat / masjid, rated 3.8+.
- Note in features if they are known to be family-friendly or near the masjid.

For both:
- Only places that exist on Google Maps and are not "Permanently closed".
- maps_url = the place's real Google Maps link.
- phone = number on the Google Maps listing only, else empty.
- price_band = Budget, Mid-range or Higher-end (from the ₹ level on Maps).
- address = the address shown on Google Maps.
- Do not invent anything. Leave cells empty when unknown.

Output ONE CSV in a code block with exactly these columns:
kind,name,city,state,address,maps_url,phone,timings,price_band,halal,features,source

kind = restaurant or hotel. source = "Google Maps".
```

Save as `data/imports/phase-4-food-hotels.csv`, then:

```bash
npm run import:listings -- data/imports/phase-4-food-hotels.csv
```

**Your own lists** (for example a KGN restaurant list) go through the same
command. Add `--kind restaurant` if the file has no `kind` column.

---

## Phase 5: Check pass (before importing)

Paste each CSV back into a **new** Gemini chat with this:

```text
Check this CSV row by row against Google Maps. For each row tell me:
- Does the place exist at that address, and does the maps_url open it?
- Is it permanently closed?
- Is the phone the one on its Google Maps listing?
- Is it a duplicate of another row (same place, different spelling)?
- For restaurants: is the halal value supported by the listing or reviews?

Return the same CSV with two extra columns at the end:
check = ok | fix | remove
check_note = what's wrong (short)

Do not change any other cells.
```

Fix or delete the `fix` / `remove` rows yourself, delete the two check
columns, then import. The importer ignores columns it doesn't know, so
leaving them in is harmless.

---

## After every import

1. `npx wrangler d1 execute jamaat_directory --remote --file=import.sql`
2. `/moderate`: approve the new **city** (a listing in a new city shows only
   once the city is approved), then its listings.
3. Click **Publish to site**.
4. Update the "Pilot cities" table in `docs/PROGRESS.md`.

Contacts and representatives: ask each person to add themselves (or give
permission) through `/contribute`, ticking **official representative** where
it applies.
