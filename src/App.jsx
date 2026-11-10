import React, { useState, useEffect, useMemo, useRef } from 'react';
// Stundenplan – kompaktes, Apple-inspiriertes Schul-Dashboard (Deutsch)
// Datenquellen: Demo-Daten · WebUntis-JSON-Import · eigenes Backend (z. B. Render) als Proxy
// Hinweis: Apple Erinnerungen und Home-Screen-Widgets sind aus einer reinen Web-App nicht direkt
// erreichbar – dafür ist eine native iOS-Hülle (EventKit / WidgetKit) nötig. Siehe Einstellungen.

/* ======================= Konstanten ======================= */

const PERIODS = [
  { s: '08:00', e: '08:45' }, { s: '08:45', e: '09:30' },
  { s: '09:50', e: '10:35' }, { s: '10:35', e: '11:20' },
  { s: '11:40', e: '12:25' }, { s: '12:25', e: '13:10' },
  { s: '13:55', e: '14:40' }, { s: '14:40', e: '15:25' },
];

const SUBJECTS = {
  englisch:    { name: 'Englisch',    color: '#FFCC00', ink: '#8A6A00', on: '#3A2E00' },
  mathe:       { name: 'Mathematik',  color: '#007AFF', ink: '#0062CC' },
  deutsch:     { name: 'Deutsch',     color: '#FF3B30', ink: '#D70015' },
  biologie:    { name: 'Biologie',    color: '#34C759', ink: '#248A3D' },
  physik:      { name: 'Physik',      color: '#5856D6', ink: '#3634A3' },
  chemie:      { name: 'Chemie',      color: '#30B0C7', ink: '#0E7C8F' },
  geschichte:  { name: 'Geschichte',  color: '#A2845E', ink: '#7F6545' },
  geographie:  { name: 'Geographie',  color: '#00C7BE', ink: '#0C817B' },
  sport:       { name: 'Sport',       color: '#FF9500', ink: '#C93400' },
  kunst:       { name: 'Kunst',       color: '#FF2D55', ink: '#D30F45' },
  musik:       { name: 'Musik',       color: '#FF6F91', ink: '#C2185B' },
  informatik:  { name: 'Informatik',  color: '#AF52DE', ink: '#8944AB' },
  pgw:         { name: 'PGW',         color: '#64D2FF', ink: '#0071A4' },
  spanisch:    { name: 'Spanisch',    color: '#E8590C', ink: '#B4420A' },
  franzoesisch:{ name: 'Französisch', color: '#5AC8FA', ink: '#0A7BB0' },
  latein:      { name: 'Latein',      color: '#8E8E93', ink: '#636366' },
  philosophie: { name: 'Philosophie', color: '#7D7AFF', ink: '#4B48C9' },
  religion:    { name: 'Religion',    color: '#C7A26B', ink: '#8B6A2F' },
  unbekannt:   { name: 'Unbekanntes Fach', color: '#8E8E93', ink: '#636366' },
};

const ALIASES = {
  englisch: ['e', 'en', 'eng', 'englisch', 'english'],
  mathe: ['m', 'ma', 'mat', 'mathe', 'mathematik', 'math'],
  deutsch: ['d', 'de', 'deu', 'deutsch'],
  biologie: ['bi', 'bio', 'biologie'],
  physik: ['ph', 'phy', 'physik'],
  chemie: ['ch', 'che', 'chemie'],
  geschichte: ['ge', 'ges', 'geschichte'],
  geographie: ['ek', 'geo', 'geographie', 'erdkunde'],
  sport: ['sp', 'spo', 'sport'],
  kunst: ['ku', 'kun', 'kunst', 'bk'],
  musik: ['mu', 'mus', 'musik'],
  informatik: ['inf', 'if', 'info', 'informatik'],
  pgw: ['pgw', 'pg', 'politik', 'pol'],
  spanisch: ['spa', 'span', 'spanisch'],
  franzoesisch: ['fr', 'frz', 'franzoesisch', 'französisch'],
  latein: ['la', 'lat', 'latein'],
  philosophie: ['phil', 'phi', 'philosophie'],
  religion: ['re', 'rel', 'religion'],
};

const SOURCE_LABEL = {
  webuntis: 'direkt von WebUntis',
  kursgruppe: 'aus Kursgruppe abgeleitet',
  text: 'aus Stundentext abgeleitet',
  manuell: 'manuell zugeordnet',
  unbekannt: 'nicht ermittelbar',
  demo: 'Demo-Daten',
};

const CUSTOM_PALETTE = ['#FF9F0A', '#64D2FF', '#BF5AF2', '#30D158', '#FF375F', '#5E5CE6', '#AC8E68'];

const STATE_META = {
  entfall: { label: 'Entfall', color: 'var(--red)' },
  vertretung: { label: 'Vertretung', color: 'var(--orange)' },
  raum: { label: 'Raumänderung', color: 'var(--orange)' },
  zusatz: { label: 'Zusatzstunde', color: 'var(--tint)' },
};

const REG = { map: SUBJECTS };
const sub = (k) => REG.map[k] || SUBJECTS.unbekannt;

/* ======================= Hilfsfunktionen ======================= */

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const at = (ds, hm) => { const d = parseD(ds); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const mins = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const uid = () => Math.random().toString(36).slice(2, 10);
const deDay = (s, o) => parseD(s).toLocaleDateString('de-DE', o);
const byTime = (a, b) => (a.date + a.start).localeCompare(b.date + b.start);
const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
};
const hhmm = (n) => {
  if (typeof n === 'string' && n.includes(':')) return n.slice(0, 5);
  const v = Number(n); return `${pad(Math.floor(v / 100))}:${pad(v % 100)}`;
};
const ymd = (n) => { const s = String(n); return s.includes('-') ? s.slice(0, 10) : `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };
const periodLabel = (start, end) => {
  const a = PERIODS.findIndex((p) => p.s === start) + 1;
  const b = PERIODS.findIndex((p) => p.e === end) + 1;
  if (!a || !b) return '';
  return a === b ? `${a}.` : `${a}.–${b}.`;
};
const relTime = (from, to) => {
  const m = Math.round((to - from) / 60000);
  if (m < 60) return `in ${m} Min.`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r ? `in ${h} Std. ${r} Min.` : `in ${h} Std.`;
};
const norm = (s) => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

const ALIAS_INDEX = (() => {
  const m = {};
  Object.entries(ALIASES).forEach(([k, arr]) => arr.forEach((a) => { m[norm(a)] = k; }));
  return m;
})();

// mode: 'exact' (WebUntis-Fachname), 'group' (Kursgruppe, z. B. "E1_S3"), 'text' (Freitext)
function matchSubject(str, mode = 'text') {
  const n = norm(str).trim();
  if (!n) return null;
  if (ALIAS_INDEX[n] && (n.length > 1 || mode !== 'text')) return ALIAS_INDEX[n];
  const tokens = n.split(/[^a-z]+/).filter(Boolean);
  for (const t of tokens) if (t.length > 1 && ALIAS_INDEX[t]) return ALIAS_INDEX[t];
  if (mode === 'group') for (const t of tokens) if (t.length === 1 && ALIAS_INDEX[t]) return ALIAS_INDEX[t];
  return null;
}

function nextLessonOf(lessons, key, now) {
  return lessons
    .filter((l) => l.subjectKey === key && l.state !== 'entfall' && at(l.date, l.start) > now)
    .sort(byTime)[0];
}

/* ======================= WebUntis-Parser ======================= */
// Unterstützt: (A) öffentliche Wochen-API (elementPeriods + elements),
// (B) JSON-RPC getTimetable (su/te/ro), (C) normalisiertes Backend-Format { lessons: [...] }.

function stateOf(p) {
  const cs = String(p.cellState || '').toUpperCase();
  const is = p.is || {};
  if (cs === 'CANCEL' || is.cancelled || p.code === 'cancelled') return 'entfall';
  if (cs === 'SUBSTITUTION' || is.substitution || p.code === 'irregular') return 'vertretung';
  if (cs === 'ROOMSUBSTITUTION' || is.roomSubstitution) return 'raum';
  if (cs === 'ADDITIONAL' || is.additional) return 'zusatz';
  return 'normal';
}

function extractRecords(json, elementId) {
  if (json && Array.isArray(json.lessons)) {
    return {
      format: 'Backend (normalisiert)', subjectElements: json.lessons.filter((l) => l.subject).length,
      records: json.lessons.map((l, i) => ({
        date: ymd(l.date), start: hhmm(l.start), end: hhmm(l.end),
        subjectNames: l.subject ? [l.subject] : [], group: l.group || '', texts: [l.text].filter(Boolean),
        teacher: l.teacher || '', room: l.room || '', state: l.state || 'normal', info: l.info || '',
        courseKey: `L${l.courseId ?? l.lessonId ?? i}`,
      })),
    };
  }
  const root = json?.data?.result?.data || json?.result?.data || json?.data?.data || json?.data || json;
  if (root && root.elementPeriods) {
    const lookup = new Map((root.elements || []).map((e) => [`${e.type}-${e.id}`, e]));
    const ep = root.elementPeriods;
    const periods = ep[String(elementId)] || Object.values(ep).flat();
    return {
      format: 'WebUntis Wochen-API',
      subjectElements: (root.elements || []).filter((e) => e.type === 3).length,
      records: periods.map((p) => {
        const els = (p.elements || []).map((r) => ({ type: r.type, ref: lookup.get(`${r.type}-${r.id}`) }));
        const subj = els.filter((e) => e.type === 3 && e.ref);
        const names = (t) => els.filter((e) => e.type === t && e.ref).map((e) => e.ref.name).filter(Boolean).join(', ');
        return {
          date: ymd(p.date), start: hhmm(p.startTime), end: hhmm(p.endTime),
          subjectNames: subj.flatMap((e) => [e.ref.longName, e.ref.name, e.ref.alternatename]).filter(Boolean),
          subjectColor: subj[0]?.ref?.backColor,
          group: p.studentGroup || '', texts: [p.lessonText, p.periodText, p.substText].filter(Boolean),
          teacher: names(2), room: names(4), state: stateOf(p),
          info: [p.substText, p.periodInfo, p.periodText].filter(Boolean).join(' · '),
          courseKey: `L${p.lessonId ?? p.lessonNumber ?? p.id}`,
        };
      }),
    };
  }
  const arr = Array.isArray(json) ? json : Array.isArray(json?.result) ? json.result : null;
  if (arr) {
    return {
      format: 'WebUntis JSON-RPC', subjectElements: arr.filter((p) => (p.su || []).length).length,
      records: arr.map((p) => ({
        date: ymd(p.date), start: hhmm(p.startTime), end: hhmm(p.endTime),
        subjectNames: (p.su || []).flatMap((s) => [s.longname, s.name]).filter(Boolean),
        group: p.sg || '', texts: [p.lstext, p.substText].filter(Boolean),
        teacher: (p.te || []).map((t) => t.name).filter(Boolean).join(', '),
        room: (p.ro || []).map((r) => r.name).filter(Boolean).join(', '),
        state: stateOf(p), info: [p.substText, p.info].filter(Boolean).join(' · '),
        courseKey: `L${p.lsnumber ?? p.id}`,
      })),
    };
  }
  throw new Error('Unbekanntes Format – erwartet wurde eine WebUntis-Antwort mit „elementPeriods“.');
}

function keepSelectedCourse(group) {
  const g = norm(group).replace(/\\s+/g, '');
  if (g.includes('plus_bkk')) return false; // keine BKK-Pluskurse
  const suffix = g.split('_').pop();
  // Wahlpflicht: WP Recht statt WP More English / Wirtschaft / Psychologie
  if (['wpeng', 'wpwir', 'wppsy1'].includes(suffix)) return false;
  // Zweite Fremdsprache: Spanisch 2 statt Französisch / Spanisch 1 / Spanisch 3
  if (['fra', 'fra2', 'spa1', 'spa3'].includes(suffix)) return false;
  // Mittwoch: Musik statt Kunst 1 / Kunst 2 / Theater
  if (['kun1', 'kun2', 'the'].includes(suffix)) return false;
  // Donnerstag: Philosophie 2 statt Philosophie 1 / Religion / Religion 2
  if (['phi1', 'rel', 'rel2'].includes(suffix)) return false;
  return true;
}

function parseTimetable(json, mapping = {}, elementId) {
  const { records, format, subjectElements } = extractRecords(json, elementId);
  const selectedRecords = records.filter((r) => keepSelectedCourse(r.group));
  if (!selectedRecords.length) throw new Error('Die Daten enthalten keine Stunden für deine gewählten Kurse.');
  const custom = {};
  const resolve = (r) => {
    if (mapping[r.courseKey]) return { key: mapping[r.courseKey], source: 'manuell' };
    for (const n of r.subjectNames) { const k = matchSubject(n, 'exact'); if (k) return { key: k, source: 'webuntis' }; }
    if (r.subjectNames.length) {
      const label = r.subjectNames[0];
      const key = 'x_' + norm(label).replace(/[^a-z0-9]+/g, '-');
      if (!custom[key]) {
        let h = 0; for (const c of label) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        let col = r.subjectColor ? (String(r.subjectColor).startsWith('#') ? r.subjectColor : '#' + r.subjectColor) : CUSTOM_PALETTE[h % CUSTOM_PALETTE.length];
        custom[key] = { name: label, color: col, ink: col };
      }
      return { key, source: 'webuntis' };
    }
    if (r.group) { const k = matchSubject(r.group, 'group'); if (k) return { key: k, source: 'kursgruppe' }; }
    for (const t of r.texts) { const k = matchSubject(t, 'text'); if (k) return { key: k, source: 'text' }; }
    return { key: 'unbekannt', source: 'unbekannt' };
  };

  const bySource = {};
  const courses = {};
  const flat = selectedRecords.map((r, i) => {
    const res = resolve(r);
    bySource[res.source] = (bySource[res.source] || 0) + 1;
    const c = courses[r.courseKey] || (courses[r.courseKey] = {
      courseKey: r.courseKey, key: res.key, source: res.source, group: r.group,
      texts: r.texts, names: r.subjectNames, count: 0,
      sample: `${deDay(r.date, { weekday: 'short' })} ${r.start}`,
    });
    c.count++;
    return { id: `${r.date}-${r.start}-${r.courseKey}-${i}`, date: r.date, start: r.start, end: r.end,
      subjectKey: res.key, source: res.source, teacher: r.teacher, room: r.room, state: r.state,
      info: r.info, courseKey: r.courseKey, group: r.group };
  }).sort(byTime);

  // Doppelstunden zusammenfassen
  const lessons = [];
  for (const l of flat) {
    const prev = lessons[lessons.length - 1];
    if (prev && prev.date === l.date && prev.courseKey === l.courseKey && prev.state === l.state &&
        mins(l.start) - mins(prev.end) <= 5 && mins(l.start) >= mins(prev.start)) {
      prev.end = l.end;
    } else lessons.push({ ...l });
  }
  lessons.forEach((l) => { l.periodLabel = periodLabel(l.start, l.end); });
  const dates = lessons.map((l) => l.date).sort();
  return { lessons, custom, diag: { format, total: selectedRecords.length, received: records.length, subjectElements, bySource,
    courses: Object.values(courses), from: dates[0], to: dates[dates.length - 1] } };
}

/* ======================= Übernommener WebUntis-Plan ======================= */
// Öffentliche Momentaufnahme von WebUntis (Schule hh5842, Klasse 10b / Element 1669),
// abgerufen am 10.11.2026. Gewählte Parallelkurse gemäß Rückmeldung des Nutzers.
// Wöchentliche Aktualisierung erfordert ein Backend; Lehrkräfte waren in der öffentlichen
// WebUntis-Antwort nicht enthalten. Englisch bleibt gelb.
const USER_TIMETABLE_PERIODS = [["2026-11-09","08:00","08:45",46057,"Sport","SH3","normal",""],["2026-11-09","08:55","09:40",46057,"Sport","SH3","normal",""],["2026-11-09","09:45","10:30",45409,"Englisch","N1.17","vertretung",""],["2026-11-09","10:55","11:40",46201,"WP Recht","N1.21","normal",""],["2026-11-09","11:45","12:30",46201,"WP Recht","N1.21","normal",""],["2026-11-09","12:35","13:05",45322,"Deutsch","N1.17","entfall",""],["2026-11-09","14:00","15:30",46009,"Spanisch 2","N1.17","normal",""],["2026-11-10","08:00","08:45",45721,"Mathematik","N1.17","normal",""],["2026-11-10","08:55","09:40",45409,"Englisch","N1.17","normal",""],["2026-11-10","09:45","10:30",45409,"Englisch","N1.17","normal",""],["2026-11-10","10:55","11:40",45322,"Deutsch","N1.17","vertretung","Aufgaben per Mail"],["2026-11-10","11:45","12:30",45322,"Deutsch","N1.17","vertretung","Aufgaben per Mail"],["2026-11-10","14:00","15:30",45832,"PGW","N1.17","normal",""],["2026-11-11","08:00","08:45",45790,"Musik","N0.02","normal",""],["2026-11-11","08:55","09:40",45790,"Musik","N0.02","normal",""],["2026-11-11","09:45","10:30",45409,"Englisch","N1.05","normal",""],["2026-11-11","10:55","11:40",45874,"Physik","N2.17","normal",""],["2026-11-11","11:45","12:30",45874,"Physik","N2.17","normal",""],["2026-11-12","08:00","08:45",45862,"Philosophie 2","N1.21","normal",""],["2026-11-12","08:55","09:40",45862,"Philosophie 2","N1.21","normal",""],["2026-11-12","09:45","10:30",46057,"Sport","SH3","normal",""],["2026-11-12","10:55","11:40",46009,"Spanisch 2","N1.17","normal",""],["2026-11-12","11:45","12:30",45721,"Mathematik","N1.17","normal",""],["2026-11-12","12:35","13:05",45721,"Mathematik","N1.17","normal",""],["2026-11-12","14:00","15:30",45217,"Biologie","N2.17","normal",""],["2026-11-13","08:00","08:45",45721,"Mathematik","N1.17","normal",""],["2026-11-13","08:55","09:40",45487,"Geographie","N1.17","normal",""],["2026-11-13","09:45","10:30",45487,"Geographie","N1.17","normal",""],["2026-11-13","10:55","11:40",45568,"Geschichte","N1.17","vertretung","2. KA MAT 10"],["2026-11-13","11:45","12:30",45568,"Geschichte","N1.17","vertretung","2. KA MAT 10"],["2026-11-13","12:35","13:05",45322,"Deutsch","N1.17","normal",""],["2026-11-16","08:00","08:45",46057,"Sport","SH3","normal",""],["2026-11-16","08:55","09:40",46057,"Sport","SH3","normal",""],["2026-11-16","09:45","10:30",45409,"Englisch","N1.17","normal",""],["2026-11-16","10:55","11:40",46201,"WP Recht","N1.21","normal",""],["2026-11-16","11:45","12:30",46201,"WP Recht","N1.21","normal",""],["2026-11-16","12:35","13:05",45322,"Deutsch","N1.17","normal",""],["2026-11-16","14:00","15:30",46009,"Spanisch 2","N1.17","normal",""],["2026-11-17","08:00","08:45",45721,"Mathematik","N1.17","vertretung","2. KA DEU 10"],["2026-11-17","08:55","09:40",45409,"Englisch","N1.17","vertretung","2. KA DEU 10"],["2026-11-17","09:45","10:30",45409,"Englisch","N1.17","normal",""],["2026-11-17","10:55","11:40",45322,"Deutsch","N1.17","normal",""],["2026-11-17","11:45","12:30",45322,"Deutsch","N1.17","normal",""],["2026-11-17","14:00","15:30",45832,"PGW","N1.17","normal",""],["2026-11-18","08:00","08:45",45790,"Musik","N0.02","normal",""],["2026-11-18","08:55","09:40",45790,"Musik","N0.02","normal",""],["2026-11-18","09:45","10:30",45409,"Englisch","N1.05","normal",""],["2026-11-18","10:55","11:40",45874,"Physik","N2.17","normal",""],["2026-11-18","11:45","12:30",45874,"Physik","N2.17","normal",""],["2026-11-19","08:00","08:45",45862,"Philosophie 2","N1.21","normal",""],["2026-11-19","08:55","09:40",45862,"Philosophie 2","N1.21","normal",""],["2026-11-19","09:45","10:30",46057,"Sport","SH3","normal",""],["2026-11-19","10:55","11:40",46009,"Spanisch 2","N1.17","normal",""],["2026-11-19","11:45","12:30",45721,"Mathematik","N1.17","normal",""],["2026-11-19","12:35","13:05",45721,"Mathematik","N1.17","normal",""],["2026-11-19","14:00","15:30",45217,"Biologie","N2.17","normal",""],["2026-11-20","08:00","08:45",45721,"Mathematik","N1.17","normal",""],["2026-11-20","08:55","09:40",45487,"Geographie","N1.17","normal",""],["2026-11-20","09:45","10:30",45487,"Geographie","N1.17","normal",""],["2026-11-20","10:55","11:40",45568,"Geschichte","N1.17","normal",""],["2026-11-20","11:45","12:30",45568,"Geschichte","N1.17","normal",""],["2026-11-20","12:35","13:05",45322,"Deutsch","N1.17","normal",""]];
const USER_TIMETABLE = { lessons: USER_TIMETABLE_PERIODS.map(([date, start, end, courseId, subject, room, state, info]) => ({
  date, start, end, courseId, subject, room, state, info,
})) };

/* ======================= Demo-Daten ======================= */

const DEMO_WEEK = [
  [[1, 2, 'mathe', 'KRÜ', '204'], [3, 2, 'englisch', 'WEN', '112'], [5, 1, 'deutsch', 'HAB', '108'], [6, 1, 'biologie', 'LOR', 'NW 2']],
  [[1, 2, 'deutsch', 'HAB', '108'], [3, 2, 'physik', 'SCH', 'NW 4'], [5, 2, 'geschichte', 'BRA', '015'], [7, 2, 'sport', 'MEY', 'Halle 1']],
  [[1, 2, 'englisch', 'WEN', '112'], [3, 2, 'mathe', 'KRÜ', '204'], [5, 2, 'informatik', 'NGU', 'IT 1']],
  [[1, 2, 'biologie', 'LOR', 'NW 2'], [3, 1, 'englisch', 'WEN', '112'], [4, 1, 'pgw', 'ÖZT', '110'], [5, 2, 'chemie', 'FIS', 'NW 3'], [7, 2, 'kunst', 'ROT', 'K 1']],
  [[1, 2, 'mathe', 'KRÜ', '204'], [3, 2, 'deutsch', 'HAB', '108'], [5, 2, 'geographie', 'KAY', '017']],
];
const DEMO_EXCEPTIONS = {
  '1-5': { state: 'vertretung', teacher: 'KLE', info: 'Vertretung für Hr. Brandt' },
  '3-5': { state: 'entfall', info: 'Lehrkraft erkrankt – Arbeitsauftrag über IServ' },
  '4-3': { state: 'raum', room: '214', info: 'Raumänderung: 214 statt 108' },
};

function generateDemo(baseMonday) {
  const out = [];
  for (let w = -1; w <= 3; w++) {
    const monday = addDays(baseMonday, w * 7);
    DEMO_WEEK.forEach((day, di) => {
      const date = fmt(addDays(monday, di));
      day.forEach(([p, len, k, t, r]) => {
        const ex = w === 0 ? DEMO_EXCEPTIONS[`${di}-${p}`] : null;
        const start = PERIODS[p - 1].s; const end = PERIODS[p + len - 2].e;
        out.push({ id: `demo-${date}-${p}`, date, start, end, periodLabel: periodLabel(start, end),
          subjectKey: k, source: 'demo', teacher: ex?.teacher || t, room: ex?.room || r,
          state: ex?.state || 'normal', info: ex?.info || '', courseKey: `demo-${k}` });
      });
    });
  }
  return out.sort(byTime);
}

function makeDemoTasks(lessons, now) {
  const m = mondayOf(now);
  const d = (n) => fmt(addDays(m, n));
  const nx = (k) => { const l = nextLessonOf(lessons, k, now); return l ? { due: l.date, dueTime: l.start } : { due: d(7), dueTime: null }; };
  const list = [
    { title: 'Vokabeln Unit 4 lernen (S. 212–214)', subjectKey: 'englisch', ...nx('englisch'), priority: 1, notes: 'Vokabeltest angekündigt' },
    { title: 'Essay: „The Great Gatsby“, Kap. 3 – Symbolik analysieren', subjectKey: 'englisch', due: d(3), dueTime: '10:35', priority: 2 },
    { title: 'Workbook p. 48, ex. 2–5', subjectKey: 'englisch', due: d(-3), done: true },
    { title: 'S. 112 Nr. 4–7 (Ableitungen)', subjectKey: 'mathe', ...nx('mathe') },
    { title: 'Klausurvorbereitung: Kurvendiskussion', subjectKey: 'mathe', due: d(9), priority: 1 },
    { title: '„Faust I“ – Szene „Nacht“ lesen und markieren', subjectKey: 'deutsch', ...nx('deutsch') },
    { title: 'Versuchsprotokoll Fadenpendel abgeben', subjectKey: 'physik', due: d(-1), priority: 2 },
    { title: 'Referat Photosynthese – Folien erstellen', subjectKey: 'biologie', due: d(10) },
    { title: 'Python-Übung: Listen & Schleifen', subjectKey: 'informatik', ...nx('informatik') },
    { title: 'Quellenanalyse Weimarer Verfassung', subjectKey: 'geschichte', due: d(8) },
  ];
  return list.map((t) => ({ id: uid(), done: false, priority: 0, notes: '', dueTime: null, ...t, source: 'demo' }));
}

// Simuliert eine echte WebUntis-Antwort, in der – wie bei dir – keine Fach-Elemente enthalten sind
function buildSampleWebUntis(monday, elementId) {
  const groups = { englisch: ['E1_S3', ''], mathe: ['M_S3', ''], deutsch: ['D_S3', ''], biologie: ['BIO_S3', ''],
    physik: ['PH_S3', ''], geschichte: ['', 'Geschichte'], sport: ['', 'Sport'], informatik: ['', ''],
    pgw: ['PGW_S3', ''], chemie: ['CH_S3', ''], kunst: ['', ''], geographie: ['GEO_S3', ''] };
  const lessonIds = {}, teachers = {}, rooms = {};
  let lid = 4100, tid = 200, rid = 300, pid = 90000;
  const periods = [];
  DEMO_WEEK.forEach((day, di) => {
    const date = Number(fmt(addDays(monday, di)).replace(/-/g, ''));
    day.forEach(([p, len, k, t, r]) => {
      if (!lessonIds[k]) lessonIds[k] = lid++;
      if (!teachers[t]) teachers[t] = tid++;
      if (!rooms[r]) rooms[r] = rid++;
      for (let i = 0; i < len; i++) {
        const P = PERIODS[p - 1 + i];
        periods.push({ id: pid++, lessonId: lessonIds[k], lessonNumber: lessonIds[k] - 4000, lessonCode: 'UNTIS_LESSON',
          lessonText: groups[k][1], periodText: '', hasPeriodText: false, date,
          startTime: Number(P.s.replace(':', '')), endTime: Number(P.e.replace(':', '')),
          elements: [{ type: 1, id: elementId, orgId: 0, missing: false, state: 'REGULAR' },
            { type: 2, id: teachers[t], orgId: 0, missing: false, state: 'REGULAR' },
            { type: 4, id: rooms[r], orgId: 0, missing: false, state: 'REGULAR' }],
          studentGroup: groups[k][0], code: 0, cellState: di === 2 && p === 5 ? 'CANCEL' : 'STANDARD',
          priority: 5, is: { standard: true } });
      }
    });
  });
  const elements = [{ type: 1, id: elementId, name: 'S3', longName: 'Profil S3', displayname: 'S3' },
    ...Object.entries(teachers).map(([n, id]) => ({ type: 2, id, name: n, longName: n })),
    ...Object.entries(rooms).map(([n, id]) => ({ type: 4, id, name: n, longName: n }))];
  return { data: { result: { data: { elementIds: [elementId], elementPeriods: { [String(elementId)]: periods }, elements } } } };
}

/* ======================= UI-Bausteine ======================= */

const ICONS = {
  today: <><path d="M7 3v3M17 3v3M4 9h16" /><rect x="4" y="5" width="16" height="15" rx="2.5" /><circle cx="12" cy="14.5" r="2" fill="currentColor" stroke="none" /></>,
  week: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9.3 10v10M14.7 10v10M7 3v3M17 3v3" /></>,
  tasks: <path d="M10 6h10M10 12h10M10 18h10M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17" />,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevL: <path d="M15 18l-6-6 6-6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  warn: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  bell: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  upload: <path d="M12 16V5M7 9.5L12 5l5 4.5M5 19h14" />,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
};

function Icon({ n, s = 20, w = 1.8, className = '' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{ICONS[n]}</svg>
  );
}

const subjVars = (k) => { const s = sub(k); return { '--c': s.color, '--ink': s.ink || s.color, '--on': s.on || '#fff' }; };

function Seg({ value, onChange, options, label, small }) {
  return (
    <div className={`seg ${small ? 'seg-sm' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function Pill({ tone = 'gray', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function StateBadge({ l }) {
  const m = STATE_META[l.state];
  if (!m) return null;
  return <span className="tag" style={{ color: m.color, borderColor: 'currentColor' }}>{m.label}</span>;
}

function Section({ title, footer, children, action }) {
  return (
    <section className="mb-6">
      {(title || action) && (
        <div className="flex items-end justify-between px-4 mb-1.5">
          <h2 className="sec-title">{title}</h2>{action}
        </div>
      )}
      <div className="card overflow-hidden">{children}</div>
      {footer && <p className="text-[12.5px] sec px-4 mt-1.5 leading-snug">{footer}</p>}
    </section>
  );
}

function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    const t = setTimeout(() => {
      const el = ref.current && (ref.current.querySelector('[data-autofocus]') || ref.current.querySelector('button'));
      if (el) el.focus();
    }, 40);
    return () => { window.removeEventListener('keydown', h); clearTimeout(t); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="overlay absolute inset-0" onClick={onClose} />
      <div ref={ref} className="sheet relative w-full md:max-w-[480px] max-h-[92vh] overflow-y-auto">
        <div className="grabber md:hidden" />
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button className="iconbtn round" onClick={onClose} aria-label="Schließen"><Icon n="x" s={16} w={2.2} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function lessonName(l) { return l.subjectKey === 'unbekannt' ? 'Unbekanntes Fach' : sub(l.subjectKey).name; }

function dueInfo(t, now) {
  if (!t.due) return null;
  const today = fmt(now); const tm = fmt(addDays(now, 1));
  const time = t.dueTime ? ` · ${t.dueTime}` : '';
  const o = { weekday: 'short', day: 'numeric', month: 'numeric' };
  if (t.due < today) return { label: `Überfällig · ${deDay(t.due, o)}`, overdue: true };
  if (t.due === today) return { label: `Heute${time}`, soon: true };
  if (t.due === tm) return { label: `Morgen${time}`, soon: true };
  return { label: deDay(t.due, o) + time };
}

function SourceTag({ source }) {
  if (source === 'demo') return <span className="mini mini-demo">Demo</span>;
  if (source === 'erinnerungen') return <span className="mini">Erinnerungen</span>;
  return <span className="mini">Lokal</span>;
}

function TaskRow({ t, now, onToggle, onDelete, showSubject }) {
  const s = sub(t.subjectKey);
  const due = dueInfo(t, now);
  return (
    <li className="row flex items-start gap-3 pl-4 pr-2 py-2.5">
      <button role="checkbox" aria-checked={t.done} aria-label={`${t.title} ${t.done ? 'als offen markieren' : 'erledigen'}`}
        onClick={() => onToggle(t.id)} className={`check mt-[1px] ${t.done ? 'on' : ''}`} style={subjVars(t.subjectKey)}>
        {t.done && <Icon n="check" s={13} w={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] leading-snug ${t.done ? 'line-through sec' : ''}`}>
          {t.priority > 0 && !t.done && <span className="font-bold" style={{ color: 'var(--tint)' }}>{'!'.repeat(t.priority)} </span>}
          {t.title}
        </div>
        <div className="text-[12.5px] sec flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {showSubject && <span className="ink font-medium" style={subjVars(t.subjectKey)}>{s.name}</span>}
          {due && <span style={{ color: due.overdue && !t.done ? 'var(--red)' : undefined, fontWeight: due.overdue && !t.done ? 600 : 400 }}>{due.label}</span>}
          <SourceTag source={t.source} />
        </div>
        {t.notes && <div className="text-[12.5px] sec mt-0.5 line-clamp-2">{t.notes}</div>}
      </div>
      <button className="iconbtn ghost" onClick={() => onDelete(t.id)} aria-label={`„${t.title}“ löschen`}><Icon n="trash" s={16} /></button>
    </li>
  );
}

function LessonRow({ l, now, taskCount, onClick }) {
  const st = at(l.date, l.start), en = at(l.date, l.end);
  const past = now >= en;
  const live = now >= st && now < en && l.state !== 'entfall';
  const meta = [l.periodLabel && `${l.periodLabel} Std.`, l.room, l.teacher].filter(Boolean).join(' · ');
  return (
    <li className="row">
      <button onClick={() => onClick(l)} className={`w-full flex items-stretch gap-3 pl-4 pr-3 py-2.5 text-left rowbtn ${past ? 'is-past' : ''} ${live ? 'is-live' : ''}`}
        style={subjVars(l.subjectKey)} aria-label={`${lessonName(l)}, ${l.start} bis ${l.end}${live ? ', läuft gerade' : ''}`}>
        <div className="w-11 shrink-0 text-right tabular-nums leading-tight pt-0.5">
          <div className="text-[14px] font-semibold">{l.start}</div>
          <div className="text-[12px] sec">{l.end}</div>
        </div>
        <div className="w-[4px] rounded-full shrink-0" style={{ background: 'var(--c)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[16px] font-semibold truncate ${l.state === 'entfall' ? 'line-through sec' : ''}`}>{lessonName(l)}</span>
            {live && <span className="live">Jetzt</span>}
            <StateBadge l={l} />
          </div>
          {meta && <div className="text-[13px] sec truncate">{meta}</div>}
          {l.info && <div className="text-[12.5px] mt-0.5 leading-snug" style={{ color: STATE_META[l.state]?.color || 'var(--sec)' }}>{l.info}</div>}
          {l.subjectKey === 'unbekannt' && (
            <div className="text-[12px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--orange)' }}>
              <Icon n="warn" s={13} /> Fach nicht geliefert · Kurs {l.courseKey}
            </div>
          )}
        </div>
        {taskCount > 0 && <span className="badge self-center" title={`${taskCount} offene Aufgaben`}>{taskCount}</span>}
        <Icon n="chevR" s={16} className="self-center ter shrink-0" />
      </button>
    </li>
  );
}

/* ======================= Ansicht: Heute ======================= */

function NowCard({ lessons, now, tasks, onOpenLesson }) {
  const today = fmt(now);
  const todays = lessons.filter((l) => l.date === today && l.state !== 'entfall').sort(byTime);
  const current = todays.find((l) => at(l.date, l.start) <= now && now < at(l.date, l.end));
  const next = lessons.filter((l) => l.state !== 'entfall' && at(l.date, l.start) > now).sort(byTime)[0];
  const openFor = (k) => tasks.filter((t) => !t.done && t.subjectKey === k).length;

  let kicker, l, line, progress = null;
  if (current) {
    l = current;
    const st = at(l.date, l.start), en = at(l.date, l.end);
    progress = Math.min(1, (now - st) / (en - st));
    kicker = 'Jetzt';
    line = `bis ${l.end} · noch ${Math.max(1, Math.round((en - now) / 60000))} Min.`;
  } else if (next && next.date === today) {
    l = next;
    const started = todays.some((x) => at(x.date, x.end) <= now);
    kicker = started ? 'Pause · Als Nächstes' : 'Schulbeginn';
    line = `${l.start} – ${l.end} · ${relTime(now, at(l.date, l.start))}`;
  } else if (next) {
    l = next;
    kicker = todays.length ? 'Unterricht beendet · Nächste Stunde' : 'Heute kein Unterricht · Nächste Stunde';
    line = `${deDay(l.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${l.start}`;
  }
  if (!l) {
    return (
      <div className="card p-4"><div className="sec text-[14px]">Keine kommenden Stunden in den geladenen Daten.</div></div>
    );
  }
  const after = current && todays.find((x) => at(x.date, x.start) >= at(current.date, current.end));
  const count = openFor(l.subjectKey);
  return (
    <button onClick={() => onOpenLesson(l)} className="nowcard card w-full text-left p-4" style={subjVars(l.subjectKey)}
      aria-label={`${kicker}: ${lessonName(l)}, ${line}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide ink">{kicker}</span>
        {l.state !== 'normal' && <StateBadge l={l} />}
      </div>
      <div className="flex items-end justify-between gap-3 mt-1">
        <div className="min-w-0">
          <div className="text-[26px] leading-tight font-bold tracking-tight truncate">{lessonName(l)}</div>
          <div className="text-[14px] sec mt-0.5">{line}</div>
        </div>
        <div className="text-right shrink-0 text-[13px] leading-snug">
          {l.room && <div className="font-semibold">{l.room}</div>}
          {l.teacher && <div className="sec">{l.teacher}</div>}
        </div>
      </div>
      {progress !== null && (
        <div className="progress mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[13px]">
        {count > 0 && <span className="flex items-center gap-1 ink font-medium"><Icon n="bell" s={14} /> {count} offene Aufgabe{count > 1 ? 'n' : ''}</span>}
        {after && <span className="sec">Danach: {lessonName(after)} um {after.start}</span>}
        {l.info && <span style={{ color: STATE_META[l.state]?.color || 'var(--sec)' }}>{l.info}</span>}
      </div>
    </button>
  );
}

function TodayView({ lessons, now, tasks, onOpenLesson, onToggle, onDelete, onQuickAdd }) {
  const today = fmt(now);
  let viewDate = today;
  if (!lessons.some((l) => l.date === today)) {
    const nx = lessons.filter((l) => l.date > today).sort(byTime)[0];
    if (nx) viewDate = nx.date;
  }
  const dayLessons = lessons.filter((l) => l.date === viewDate).sort(byTime);
  const dueTasks = (date, k) => tasks.filter((t) => !t.done && t.subjectKey === k && t.due === date).length;
  const horizon = fmt(addDays(now, 2));
  const urgent = tasks.filter((t) => !t.done && t.due && t.due <= horizon)
    .sort((a, b) => (a.due + (a.dueTime || '')).localeCompare(b.due + (b.dueTime || '')));
  const dayTitle = viewDate === today ? 'Stundenplan heute'
    : `Nächster Schultag · ${deDay(viewDate, { weekday: 'long', day: 'numeric', month: 'numeric' })}`;

  return (
    <div className="grid gap-x-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-6"><NowCard lessons={lessons} now={now} tasks={tasks} onOpenLesson={onOpenLesson} /></div>
        <Section title={dayTitle} footer={dayLessons.length ? `${dayLessons.filter((l) => l.state !== 'entfall').length} Stunden · tippe für Details und Aufgaben` : null}>
          {dayLessons.length ? (
            <ul>{dayLessons.map((l) => <LessonRow key={l.id} l={l} now={now} taskCount={dueTasks(l.date, l.subjectKey)} onClick={onOpenLesson} />)}</ul>
          ) : <div className="p-4 sec text-[14px]">Keine Stunden vorhanden.</div>}
        </Section>
      </div>
      <div>
        <Section title="Bald fällig" action={<button className="linkbtn" onClick={() => onQuickAdd()}>Neu</button>}
          footer="Überfällig, heute und in den nächsten zwei Tagen.">
          {urgent.length ? (
            <ul>{urgent.map((t) => <TaskRow key={t.id} t={t} now={now} onToggle={onToggle} onDelete={onDelete} showSubject />)}</ul>
          ) : (
            <div className="p-5 text-center">
              <div className="text-[15px] font-medium">Alles erledigt 🎉</div>
              <div className="sec text-[13px] mt-0.5">In den nächsten zwei Tagen ist nichts fällig.</div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

/* ======================= Ansicht: Woche ======================= */

function WeekView({ lessons, now, weekStart, onWeekChange, tasks, onOpenLesson, mode, loadingWeek }) {
  const days = [0, 1, 2, 3, 4].map((i) => fmt(addDays(weekStart, i)));
  const wl = lessons.filter((l) => days.includes(l.date));
  const today = fmt(now);
  const [sel, setSel] = useState(Math.max(0, days.indexOf(today)));
  const wkKey = fmt(weekStart);
  useEffect(() => { const i = days.indexOf(today); setSel(i >= 0 ? i : 0); }, [wkKey]);

  let s0 = wl.length ? Math.min(...wl.map((l) => mins(l.start))) : 480;
  let e0 = wl.length ? Math.max(...wl.map((l) => mins(l.end))) : 930;
  s0 = Math.floor(s0 / 60) * 60; e0 = Math.ceil(e0 / 60) * 60;
  const ppm = 1.05; const H = (e0 - s0) * ppm;
  const hours = []; for (let m = s0; m <= e0; m += 60) hours.push(m);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dueCount = (l) => tasks.filter((t) => !t.done && t.subjectKey === l.subjectKey && t.due === l.date).length;
  const endD = addDays(weekStart, 4);
  const range = `${weekStart.getDate()}.${weekStart.getMonth() !== endD.getMonth() ? ` ${weekStart.toLocaleDateString('de-DE', { month: 'short' })}` : ''} – ${endD.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`;
  const isThisWeek = fmt(mondayOf(now)) === wkKey;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <div className="text-[20px] font-bold tracking-tight">KW {isoWeek(weekStart)}</div>
          <div className="text-[13px] sec">{range}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isThisWeek && <button className="btn-fill text-[13px]" onClick={() => onWeekChange(mondayOf(now))}>Heute</button>}
          <button className="iconbtn round" onClick={() => onWeekChange(addDays(weekStart, -7))} aria-label="Vorige Woche"><Icon n="chevL" s={18} w={2.2} /></button>
          <button className="iconbtn round" onClick={() => onWeekChange(addDays(weekStart, 7))} aria-label="Nächste Woche"><Icon n="chevR" s={18} w={2.2} /></button>
        </div>
      </div>

      {!wl.length ? (
        <div className="card p-6 text-center">
          <div className="text-[15px] font-medium">{loadingWeek ? 'Stundenplan wird live geladen …' : 'Keine Stunden für diese Woche'}</div>
          <div className="sec text-[13px] mt-1">
            {mode === 'demo' ? 'Demo-Daten reichen nur einige Wochen.' : loadingWeek ? 'WebUntis wird abgefragt. Neue Wochen erscheinen nach dem Abruf.' : 'Lade die Woche über dein WebUntis-Backend in den Einstellungen. Frühere und spätere Wochen können fortlaufend abgerufen werden.'}
          </div>
        </div>
      ) : (
        <>
          {/* Telefon: Tagesauswahl + Liste */}
          <div className="md:hidden">
            <div className="daypick mb-3" role="tablist" aria-label="Wochentag">
              {days.map((d, i) => (
                <button key={d} role="tab" aria-selected={sel === i} onClick={() => setSel(i)} className={d === today ? 'is-today' : ''}>
                  <span className="text-[11px] font-medium uppercase">{deDay(d, { weekday: 'short' }).replace('.', '')}</span>
                  <span className="text-[17px] font-semibold tabular-nums">{parseD(d).getDate()}</span>
                  <span className="dots">{wl.filter((l) => l.date === d).slice(0, 5).map((l) => <i key={l.id} style={{ background: sub(l.subjectKey).color }} />)}</span>
                </button>
              ))}
            </div>
            <div className="card overflow-hidden">
              <ul>{wl.filter((l) => l.date === days[sel]).map((l) => <LessonRow key={l.id} l={l} now={now} taskCount={dueCount(l)} onClick={onOpenLesson} />)}</ul>
              {!wl.some((l) => l.date === days[sel]) && <div className="p-4 sec text-[14px]">Kein Unterricht.</div>}
            </div>
          </div>

          {/* iPad / Desktop: Zeitraster */}
          <div className="hidden md:block card p-3 overflow-x-auto">
            <div className="grid min-w-[620px]" style={{ gridTemplateColumns: '40px repeat(5, minmax(0,1fr))' }}>
              <div />
              {days.map((d) => (
                <div key={d} className={`text-center pb-2 ${d === today ? 'ink-tint' : ''}`}>
                  <div className="text-[11px] font-semibold uppercase sec">{deDay(d, { weekday: 'short' }).replace('.', '')}</div>
                  <div className={`daynum ${d === today ? 'is-today' : ''}`}>{parseD(d).getDate()}</div>
                </div>
              ))}
              <div className="relative" style={{ height: H }}>
                {hours.map((m) => (
                  <div key={m} className="absolute right-1.5 text-[10.5px] sec tabular-nums" style={{ top: (m - s0) * ppm - 6 }}>{pad(m / 60)}:00</div>
                ))}
              </div>
              {days.map((d) => (
                <div key={d} className={`relative daycol ${d === today ? 'is-today' : ''}`} style={{ height: H }}>
                  {hours.map((m) => <div key={m} className="hline" style={{ top: (m - s0) * ppm }} />)}
                  {wl.filter((l) => l.date === d).map((l) => {
                    const top = (mins(l.start) - s0) * ppm; const h = (mins(l.end) - mins(l.start)) * ppm - 3;
                    const c = dueCount(l);
                    return (
                      <button key={l.id} onClick={() => onOpenLesson(l)} style={{ top, height: h, ...subjVars(l.subjectKey) }}
                        className={`blk ${l.state === 'entfall' ? 'is-cancel' : ''}`} aria-label={`${lessonName(l)}, ${deDay(d, { weekday: 'long' })} ${l.start} bis ${l.end}`}>
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[12.5px] font-semibold ink truncate leading-tight">{l.subjectKey === 'unbekannt' ? 'Unbekannt' : sub(l.subjectKey).name}</span>
                          {c > 0 && <span className="badge badge-sm">{c}</span>}
                        </div>
                        <div className="text-[11px] sec truncate leading-tight mt-0.5">{l.start}–{l.end}</div>
                        {h > 50 && <div className="text-[11px] sec truncate leading-tight">{[l.room, l.teacher].filter(Boolean).join(' · ')}</div>}
                        {h > 70 && l.state !== 'normal' && <div className="text-[10.5px] font-semibold mt-0.5" style={{ color: STATE_META[l.state]?.color }}>{STATE_META[l.state]?.label}</div>}
                      </button>
                    );
                  })}
                  {d === today && nowMin >= s0 && nowMin <= e0 && (
                    <div className="nowline" style={{ top: (nowMin - s0) * ppm }} aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ======================= Ansicht: Aufgaben ======================= */

function TasksView({ tasks, lessons, now, onToggle, onDelete, onQuickAdd, subjectOrder }) {
  const [filter, setFilter] = useState('offen');
  const [subj, setSubj] = useState('alle');
  const [q, setQ] = useState('');
  const horizon = fmt(addDays(now, 2));
  const visible = tasks.filter((t) => {
    if (filter === 'offen' && t.done) return false;
    if (filter === 'bald' && (t.done || !t.due || t.due > horizon)) return false;
    if (filter === 'erledigt' && !t.done) return false;
    if (subj !== 'alle' && t.subjectKey !== subj) return false;
    if (q && !norm(t.title + ' ' + t.notes).includes(norm(q))) return false;
    return true;
  });
  const keys = [...new Set([...subjectOrder, ...tasks.map((t) => t.subjectKey)])];
  const groups = keys.map((k) => ({ k, items: visible.filter((t) => t.subjectKey === k)
    .sort((a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999') || b.priority - a.priority) }))
    .filter((g) => g.items.length);
  const chipKeys = keys.filter((k) => tasks.some((t) => t.subjectKey === k));

  return (
    <div>
      <div className="flex flex-col gap-2.5 mb-4">
        <label className="search">
          <Icon n="search" s={17} className="sec" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aufgaben durchsuchen" aria-label="Aufgaben durchsuchen" />
          {q && <button onClick={() => setQ('')} aria-label="Suche leeren" className="sec"><Icon n="x" s={15} w={2.2} /></button>}
        </label>
        <Seg label="Filter" value={filter} onChange={setFilter}
          options={[{ value: 'offen', label: 'Offen' }, { value: 'bald', label: 'Bald fällig' }, { value: 'erledigt', label: 'Erledigt' }, { value: 'alle', label: 'Alle' }]} />
        <div className="chips" role="group" aria-label="Nach Fach filtern">
          <button className="chip" aria-pressed={subj === 'alle'} onClick={() => setSubj('alle')}>Alle Fächer</button>
          {chipKeys.map((k) => (
            <button key={k} className="chip" aria-pressed={subj === k} onClick={() => setSubj(subj === k ? 'alle' : k)} style={subjVars(k)}>
              <i className="dot" />{sub(k).name}
            </button>
          ))}
        </div>
      </div>

      {groups.length ? (
        <div className="md:columns-2 md:gap-6">
          {groups.map(({ k, items }) => {
            const nl = nextLessonOf(lessons, k, now);
            return (
              <div key={k} className="break-inside-avoid">
                <Section
                  title={<span className="flex items-center gap-2" style={subjVars(k)}><i className="dot dot-lg" /><span className="ink" style={{ textTransform: 'none', fontSize: 15, fontWeight: 700, letterSpacing: 0 }}>{sub(k).name}</span><span className="sec font-normal" style={{ textTransform: 'none' }}>{items.filter((t) => !t.done).length} offen</span></span>}
                  action={<button className="linkbtn" onClick={() => onQuickAdd(k)} aria-label={`Aufgabe für ${sub(k).name} hinzufügen`}><Icon n="plus" s={18} w={2.2} /></button>}
                  footer={nl ? `Nächste Stunde: ${deDay(nl.date, { weekday: 'short', day: 'numeric', month: 'numeric' })}, ${nl.start}${nl.room ? ` · ${nl.room}` : ''}` : null}>
                  <ul>{items.map((t) => <TaskRow key={t.id} t={t} now={now} onToggle={onToggle} onDelete={onDelete} />)}</ul>
                </Section>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="text-[15px] font-medium">Keine Aufgaben gefunden</div>
          <div className="sec text-[13px] mt-1">Passe Filter oder Suche an – oder lege eine neue Aufgabe an.</div>
          <button className="btn-tint mt-4 px-4 py-2" onClick={() => onQuickAdd(subj !== 'alle' ? subj : undefined)}>Aufgabe hinzufügen</button>
        </div>
      )}
    </div>
  );
}

/* ======================= Ansicht: Einstellungen ======================= */

function StatusRow({ title, state, msg, icon }) {
  const tones = { demo: ['yellow', 'Demo-Daten'], import: ['blue', 'Importiert'], live: ['green', 'Verbunden'],
    loading: ['gray', 'Lädt …'], error: ['red', 'Fehler'], none: ['gray', 'Nicht verbunden'] };
  const [tone, label] = tones[state] || tones.none;
  return (
    <div className="row flex items-start gap-3 px-4 py-3">
      <div className={`appicon tone-${tone}`}><Icon n={icon} s={18} w={2} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-medium">{title}</span><Pill tone={tone}>{label}</Pill>
        </div>
        {msg && <div className="text-[12.5px] sec mt-0.5 leading-snug">{msg}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="row flex items-center gap-3 px-4 py-2 min-h-[44px]">
      <span className="text-[15px] w-32 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </label>
  );
}

function SettingsView(p) {
  const { cfg, setCfg, conn, mode, diag, parseError, mapping, setMapping, subjects, onImport, onLoadLive, onSyncReminders,
    onUseDemo, onSample, sim, setSim, onClearDemoTasks, weekStart } = p;
  const [text, setText] = useState('');
  const fileRef = useRef(null);
  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const apiUrl = `https://<server>.webuntis.com/WebUntis/api/public/timetable/weekly/data?elementType=${cfg.elementType}&elementId=${cfg.elementId}&date=${fmt(weekStart)}&formatId=1`;
  const subjectOptions = Object.entries(subjects).filter(([k]) => k !== 'unbekannt');
  const courses = diag ? [...diag.courses].sort((a, b) => (a.source === 'unbekannt' ? -1 : 0) - (b.source === 'unbekannt' ? -1 : 0) || b.count - a.count) : [];

  return (
    <div className="grid gap-x-6 lg:grid-cols-2">
      <div>
        <Section title="Verbindungen" footer={mode === 'demo' ? 'Solange nichts verbunden ist, siehst du realistische Demo-Daten – überall mit „Demo“ gekennzeichnet.' : 'Der Stundenplan ist eine öffentliche WebUntis-Momentaufnahme für den 09.–20.11.2026 und wird nicht automatisch aktualisiert.'}>
          <StatusRow title="WebUntis" icon="week" state={conn.webuntis.state}
            msg={conn.webuntis.msg || (mode === 'demo' ? `Schule ${cfg.school} · Element ${cfg.elementId} – noch nicht importiert.` : '')} />
          <StatusRow title="Apple Erinnerungen" icon="bell" state={conn.reminders.state}
            msg={conn.reminders.msg || 'Aufgaben werden lokal in der App geführt. Direkter Zugriff erfordert eine native iOS-App (EventKit) – siehe unten.'} />
        </Section>

        <Section title="WebUntis" footer="Für Live-Sync: URL des Render-Proxys eintragen. Die App lädt die aktuelle Woche und drei Folgewochen automatisch, aktualisiert sie alle 15 Minuten und lädt beim Weiterblättern jede weitere Woche nach. Direkter Browserabruf bei WebUntis ist wegen CORS nicht zuverlässig.">
          <Field label="Schule"><input className="inp" value={cfg.school} onChange={set('school')} /></Field>
          <Field label="Elementtyp">
            <select className="inp" value={cfg.elementType} onChange={set('elementType')}>
              <option value="1">1 · Klasse</option><option value="2">2 · Lehrkraft</option>
              <option value="4">4 · Raum</option><option value="5">5 · Schüler:in</option>
            </select>
          </Field>
          <Field label="Element-ID"><input className="inp" inputMode="numeric" value={cfg.elementId} onChange={set('elementId')} /></Field>
          <Field label="Live-Backend"><input className="inp" placeholder="https://dein-dienst.onrender.com" value={cfg.backend} onChange={set('backend')} /></Field>
          <div className="row flex flex-wrap gap-2 px-4 py-3">
            <button className="btn-tint px-3.5 py-2 text-[14px] flex items-center gap-1.5" onClick={onLoadLive} disabled={!cfg.backend || conn.webuntis.state === 'loading'}>
              <Icon n="refresh" s={16} w={2} /> Diese Woche aktualisieren
            </button>
            <button className="btn-fill px-3.5 py-2 text-[14px]" onClick={onUseDemo} disabled={mode === 'demo'}>Demo-Daten verwenden</button>
          </div>
        </Section>

        <Section title="JSON-Import" footer={<>Öffne im Browser, in dem du bei WebUntis angemeldet bist: <code className="code break-all">{apiUrl}</code> – kopiere die Antwort hierher oder speichere sie als Datei.</>}>
          <div className="p-3">
            <textarea className="inp mono" rows={4} value={text} onChange={(e) => setText(e.target.value)}
              placeholder='{"data":{"result":{"data":{"elementPeriods": … }}}}' aria-label="WebUntis-JSON einfügen" />
            <div className="flex flex-wrap gap-2 mt-2.5">
              <button className="btn-tint px-3.5 py-2 text-[14px]" disabled={!text.trim()} onClick={() => onImport(text)}>Importieren</button>
              <button className="btn-fill px-3.5 py-2 text-[14px] flex items-center gap-1.5" onClick={() => fileRef.current && fileRef.current.click()}><Icon n="upload" s={16} w={2} /> Datei wählen</button>
              <button className="btn-fill px-3.5 py-2 text-[14px]" onClick={onSample}>Beispiel ohne Fächer testen</button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
                onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) f.text().then(onImport); e.target.value = ''; }} />
            </div>
            {parseError && <div className="text-[13px] mt-2 flex items-start gap-1.5" style={{ color: 'var(--red)' }}><Icon n="warn" s={15} /> {parseError}</div>}
          </div>
        </Section>
      </div>

      <div>
        <Section title="Fächer-Zuordnung"
          footer={diag ? 'Zuordnungen gelten pro Kurs (lessonId) und werden sofort auf alle Stunden angewendet.' : 'Nach dem Import siehst du hier, woher jedes Fach stammt, und kannst fehlende Fächer zuordnen.'}>
          {!diag ? (
            <div className="p-4 text-[14px] sec">Keine Importdaten. Teste mit „Beispiel ohne Fächer testen“, wie die App mit leeren Fächern (subjects = ()) umgeht.</div>
          ) : (
            <>
              <div className="px-4 py-3 text-[13px] leading-relaxed">
                <div><span className="sec">Format:</span> {diag.format} · {diag.total} Einzelstunden · {deDay(diag.from, { day: 'numeric', month: 'numeric' })}–{deDay(diag.to, { day: 'numeric', month: 'numeric' })}</div>
                {diag.subjectElements === 0 && (
                  <div className="mt-1.5 flex items-start gap-1.5" style={{ color: 'var(--orange)' }}>
                    <Icon n="warn" s={15} className="shrink-0 mt-0.5" />
                    <span>WebUntis lieferte keine Fach-Elemente (Typ 3). Das passiert oft beim öffentlichen Zugriff. Die App leitet Fächer aus Kursgruppe und Stundentext ab, den Rest kannst du unten zuordnen.</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(diag.bySource).map(([s, n]) => <Pill key={s} tone={s === 'unbekannt' ? 'red' : s === 'webuntis' ? 'green' : 'blue'}>{n}× {SOURCE_LABEL[s]}</Pill>)}
                </div>
              </div>
              <ul>
                {courses.map((c) => {
                  const cur = mapping[c.courseKey] || '';
                  const shown = cur || c.key;
                  return (
                    <li key={c.courseKey} className="row flex items-center gap-3 px-4 py-2.5" style={subjVars(shown)}>
                      <i className="dot dot-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium truncate">{shown === 'unbekannt' ? <span style={{ color: 'var(--orange)' }}>Unbekannt</span> : sub(shown).name}
                          <span className="sec font-normal"> · {c.courseKey} · {c.count}×</span></div>
                        <div className="text-[11.5px] sec truncate mono">
                          {[c.group && `Gruppe ${c.group}`, c.texts[0] && `Text „${c.texts[0]}“`, c.names[0] && `Fach ${c.names[0]}`, c.sample].filter(Boolean).join(' · ')}
                        </div>
                        <div className="text-[11.5px] sec">{SOURCE_LABEL[cur ? 'manuell' : c.source]}</div>
                      </div>
                      <select className="inp inp-sm w-[132px]" value={cur} aria-label={`Fach für Kurs ${c.courseKey}`}
                        onChange={(e) => { const m = { ...mapping }; if (e.target.value) m[c.courseKey] = e.target.value; else delete m[c.courseKey]; setMapping(m); }}>
                        <option value="">Automatisch</option>
                        {subjectOptions.map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>

        <Section title="Erinnerungen-Brücke (optional)"
          footer="Experimentell: Startet auf dem iPhone einen Kurzbefehl, der die Aufgabe in Erinnerungen anlegt. Den Kurzbefehl musst du einmalig selbst erstellen (Eingabe: Text/JSON → „Erinnerung hinzufügen“).">
          <label className="row flex items-center justify-between px-4 py-2.5 min-h-[44px]">
            <span className="text-[15px]">Kurzbefehl-Link anbieten</span>
            <input type="checkbox" className="switch" checked={cfg.shortcut} onChange={set('shortcut')} />
          </label>
          {cfg.shortcut && <Field label="Name"><input className="inp" value={cfg.shortcutName} onChange={set('shortcutName')} /></Field>}
          <div className="row px-4 py-3">
            <button className="btn-fill px-3.5 py-2 text-[14px]" onClick={onSyncReminders} disabled={!cfg.backend}>Erinnerungen vom Backend abrufen</button>
          </div>
        </Section>

        <Section title="Native iOS-Funktionen">
          <div className="p-4 text-[13.5px] leading-relaxed space-y-2">
            <p><b>Was eine Web-App nicht kann:</b> Apple Erinnerungen direkt lesen/schreiben und echte Home-Screen-Widgets anzeigen.</p>
            <p><b>Dafür nötig:</b> eine native iOS-Hülle (SwiftUI oder Capacitor) mit <b>EventKit</b> (EKReminder, Listen wie „Schule · Englisch“) und <b>WidgetKit</b> für das Widget „Jetzt / Als Nächstes“.</p>
            <details className="mt-1">
              <summary className="cursor-pointer font-medium" style={{ color: 'var(--tint)' }}>Schnittstellen für Entwickler</summary>
              <ul className="mt-2 space-y-1.5 mono text-[12px]">
                <li>GET /api/webuntis/week?school&amp;elementType&amp;elementId&amp;date → rohe WebUntis-Antwort oder {'{ lessons: [{date,start,end,subject,teacher,room,state,info,courseId}] }'}</li>
                <li>GET /api/reminders → [{'{id,title,list,dueDate,completed,notes}'}]</li>
                <li>POST /api/reminders ← {'{title,list,dueDate,notes,priority}'}</li>
                <li>Zuordnung Liste → Fach: „Schule · Englisch“ oder Tag #englisch</li>
                <li>Zugangsdaten nur als Umgebungsvariablen im Backend (z. B. Render) – nie im Frontend.</li>
              </ul>
            </details>
          </div>
        </Section>

        {mode === 'demo' && (
          <Section title="Demo" footer="Simuliere eine Uhrzeit, um „Jetzt“, Pausen und Fälligkeiten auszuprobieren.">
            <label className="row flex items-center justify-between px-4 py-2.5 min-h-[44px]">
              <span className="text-[15px]">Uhrzeit simulieren</span>
              <input type="checkbox" className="switch" checked={sim.on} onChange={(e) => setSim({ ...sim, on: e.target.checked })} />
            </label>
            {sim.on && <Field label="Zeitpunkt"><input type="datetime-local" className="inp" value={sim.value} onChange={(e) => setSim({ ...sim, value: e.target.value })} /></Field>}
            <div className="row px-4 py-3"><button className="btn-fill px-3.5 py-2 text-[14px]" onClick={onClearDemoTasks}>Demo-Aufgaben entfernen</button></div>
          </Section>
        )}
        <p className="text-[12px] sec px-4 pb-4">Hinweis: In dieser Vorschau werden Daten nicht dauerhaft gespeichert.</p>
      </div>
    </div>
  );
}

/* ======================= Sheets ======================= */

function QuickAdd({ lessons, now, defaultSubject, subjectOrder, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [k, setK] = useState(defaultSubject);
  const [mode, setMode] = useState('next');
  const [date, setDate] = useState(fmt(addDays(now, 1)));
  const [prio, setPrio] = useState(0);
  const [notes, setNotes] = useState('');
  const nl = nextLessonOf(lessons, k, now);
  const effMode = mode === 'next' && !nl ? 'tomorrow' : mode;
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    let due = null, dueTime = null;
    if (effMode === 'next') { due = nl.date; dueTime = nl.start; }
    if (effMode === 'tomorrow') due = fmt(addDays(now, 1));
    if (effMode === 'date') due = date;
    onSave({ id: uid(), title: title.trim(), subjectKey: k, due, dueTime, priority: prio, notes: notes.trim(), done: false, source: 'lokal' });
  };
  return (
    <form onSubmit={submit} className="px-4 pb-5">
      <input data-autofocus className="inp inp-lg" placeholder="Was ist zu tun?" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titel" />
      <div className="sec-title mt-4 mb-1.5">Fach</div>
      <div className="chips wrap">
        {subjectOrder.map((s) => (
          <button type="button" key={s} className="chip" aria-pressed={k === s} onClick={() => setK(s)} style={subjVars(s)}>
            <i className="dot" />{sub(s).name}
          </button>
        ))}
      </div>
      <div className="sec-title mt-4 mb-1.5">Fällig</div>
      <Seg small label="Fälligkeit" value={effMode} onChange={setMode}
        options={[...(nl ? [{ value: 'next', label: 'Nächste Stunde' }] : []), { value: 'tomorrow', label: 'Morgen' }, { value: 'date', label: 'Datum' }, { value: 'none', label: 'Ohne' }]} />
      <div className="text-[12.5px] sec mt-1.5 min-h-[18px]">
        {effMode === 'next' && nl && `${deDay(nl.date, { weekday: 'long', day: 'numeric', month: 'numeric' })}, ${nl.start}${nl.room ? ` · Raum ${nl.room}` : ''}`}
        {effMode === 'date' && <input type="date" className="inp inp-sm mt-1" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" />}
        {mode === 'next' && !nl && 'Keine weitere Stunde in den geladenen Daten – „Morgen“ gewählt.'}
      </div>
      <div className="sec-title mt-3 mb-1.5">Priorität</div>
      <Seg small label="Priorität" value={prio} onChange={setPrio}
        options={[{ value: 0, label: 'Keine' }, { value: 1, label: '!' }, { value: 2, label: '!!' }, { value: 3, label: '!!!' }]} />
      <textarea className="inp mt-4" rows={2} placeholder="Notizen" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notizen" />
      <div className="flex gap-2 mt-4">
        <button type="button" className="btn-fill flex-1 py-2.5" onClick={onCancel}>Abbrechen</button>
        <button type="submit" className="btn-tint flex-1 py-2.5" disabled={!title.trim()}>Hinzufügen</button>
      </div>
    </form>
  );
}

function LessonDetail({ l, tasks, now, onToggle, onDelete, onAdd }) {
  const s = sub(l.subjectKey);
  const list = tasks.filter((t) => t.subjectKey === l.subjectKey).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return (
    <div className="pb-5" style={subjVars(l.subjectKey)}>
      <div className="mx-4 rounded-2xl p-4 tintbg">
        <div className="text-[22px] font-bold tracking-tight">{lessonName(l)}</div>
        <div className="text-[14px] mt-0.5">{deDay(l.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {l.start}–{l.end}{l.periodLabel ? ` · ${l.periodLabel} Std.` : ''}</div>
        <div className="text-[14px] sec mt-0.5">{[l.room && `Raum ${l.room}`, l.teacher].filter(Boolean).join(' · ') || 'Kein Raum / keine Lehrkraft übermittelt'}</div>
        {l.state !== 'normal' && <div className="mt-2 flex items-center gap-2"><StateBadge l={l} /><span className="text-[13px]">{l.info}</span></div>}
        <div className="text-[12px] sec mt-2 flex items-center gap-1"><Icon n="info" s={13} /> Fach {SOURCE_LABEL[l.source] || l.source}{l.group ? ` (Gruppe „${l.group}“)` : ''}</div>
      </div>
      <div className="flex items-center justify-between px-4 mt-5 mb-1.5">
        <h3 className="sec-title">Aufgaben · {s.name}</h3>
      </div>
      <div className="mx-4 card-inset overflow-hidden">
        {list.length ? <ul>{list.map((t) => <TaskRow key={t.id} t={t} now={now} onToggle={onToggle} onDelete={onDelete} />)}</ul>
          : <div className="p-4 text-[14px] sec">Keine Aufgaben für dieses Fach.</div>}
      </div>
      <div className="px-4 mt-4">
        <button className="btn-tint w-full py-2.5 flex items-center justify-center gap-1.5" onClick={() => onAdd(l.subjectKey)}>
          <Icon n="plus" s={17} w={2.4} /> Aufgabe für {l.subjectKey === 'unbekannt' ? 'diese Stunde' : s.name}
        </button>
      </div>
    </div>
  );
}

/* ======================= App ======================= */

const NAV = [
  { id: 'heute', label: 'Heute', icon: 'today' },
  { id: 'woche', label: 'Woche', icon: 'week' },
  { id: 'aufgaben', label: 'Aufgaben', icon: 'tasks' },
  { id: 'einstellungen', label: 'Einstellungen', icon: 'settings' },
];

export default function App() {
  const [realNow, setRealNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setRealNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const [sim, setSim] = useState(() => {
    const m = mondayOf(new Date()); const d = new Date().getDay();
    const base = d === 0 || d === 6 ? m : new Date(); // Wochentag: heute, sonst Montag
    return { on: false, value: `${fmt(base)}T10:05` };
  });
  const simDate = sim.on && sim.value ? new Date(sim.value) : null;
  const now = simDate && !isNaN(simDate) ? simDate : realNow;

  const [mode, setMode] = useState('import');
  const [raw, setRaw] = useState(USER_TIMETABLE);
  const [liveWeeks, setLiveWeeks] = useState({});
  const [liveSubjects, setLiveSubjects] = useState({});
  const [loadingWeeks, setLoadingWeeks] = useState({});
  const inFlightWeeks = useRef(new Set());
  const [mapping, setMapping] = useState({});
  const [cfg, setCfg] = useState({ school: 'hh5842', elementType: '1', elementId: '1669', backend: typeof window !== 'undefined' ? window.location.origin : '', shortcut: false, shortcutName: 'Schul-Erinnerung' });
  const [conn, setConn] = useState({ webuntis: { state: 'import', msg: 'Öffentlicher WebUntis-Plan · KW 46–47 (09.–20.11.2026) · Stand 10.11.2026, 19:56 · nicht live aktualisiert' }, reminders: { state: 'none', msg: '' } });
  const [tab, setTab] = useState('heute');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [toast, setToast] = useState(null);
  const [addOpen, setAddOpen] = useState(null);
  const [detail, setDetail] = useState(null);

  const baseKey = fmt(mondayOf(realNow));
  const demoLessons = useMemo(() => generateDemo(mondayOf(realNow)), [baseKey]);
  const [tasks, setTasks] = useState(() => makeDemoTasks(generateDemo(mondayOf(new Date())), new Date()));

  const parsed = useMemo(() => {
    if (!raw) return null;
    try { return { ok: true, ...parseTimetable(raw, mapping, cfg.elementId) }; } catch (e) { return { ok: false, error: e.message }; }
  }, [raw, mapping, cfg.elementId]);
  const subjects = useMemo(() => ({ ...SUBJECTS, ...((parsed && parsed.custom) || {}), ...liveSubjects }), [parsed, liveSubjects]);
  REG.map = subjects;
  const cachedLive = Object.values(liveWeeks).flat();
  const cachedDates = new Set(cachedLive.map((l) => l.date));
  const importedLessons = parsed && parsed.ok ? parsed.lessons : [];
  const lessons = mode === 'demo' ? demoLessons : mode === 'live'
    ? [...importedLessons.filter((l) => !cachedDates.has(l.date)), ...cachedLive].sort(byTime)
    : importedLessons;

  const subjectOrder = useMemo(() => {
    const seen = [];
    [...lessons].sort(byTime).forEach((l) => { if (!seen.includes(l.subjectKey) && l.subjectKey !== 'unbekannt') seen.push(l.subjectKey); });
    if (lessons.some((l) => l.subjectKey === 'unbekannt')) seen.push('unbekannt');
    return seen.length ? seen : ['englisch', 'mathe', 'deutsch'];
  }, [lessons]);

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const today = fmt(now);
  const currentL = lessons.find((l) => l.date === today && l.state !== 'entfall' && at(l.date, l.start) <= now && now < at(l.date, l.end));
  const nextL = lessons.filter((l) => l.state !== 'entfall' && at(l.date, l.start) > now).sort(byTime)[0];
  const defaultSubject = (currentL || nextL || {}).subjectKey || subjectOrder[0];

  const openAdd = (k) => { setDetail(null); setAddOpen({ k: k || defaultSubject, n: Date.now() }); };
  const toggle = (id) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id) => {
    const t = tasks.find((x) => x.id === id);
    setTasks((ts) => ts.filter((x) => x.id !== id));
    setToast({ msg: `„${t ? t.title : 'Aufgabe'}“ gelöscht`, undo: () => setTasks((ts) => [...ts, t]) });
  };

  const shortcutUrl = (t) => {
    const payload = { title: t.title, list: `Schule · ${sub(t.subjectKey).name}`, due: t.due ? `${t.due}${t.dueTime ? 'T' + t.dueTime : ''}` : null, notes: t.notes, priority: t.priority };
    return `shortcuts://run-shortcut?name=${encodeURIComponent(cfg.shortcutName)}&input=text&text=${encodeURIComponent(JSON.stringify(payload))}`;
  };

  const saveTask = async (t) => {
    setTasks((ts) => [...ts, t]);
    setAddOpen(null);
    let msg = `Gespeichert in ${sub(t.subjectKey).name} (lokal)`;
    if (conn.reminders.state === 'live' && cfg.backend) {
      try {
        const r = await fetch(`${cfg.backend.replace(/\/+$/, '')}/api/reminders`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: t.title, list: `Schule · ${sub(t.subjectKey).name}`, dueDate: t.due, notes: t.notes, priority: t.priority }) });
        if (!r.ok) throw new Error();
        msg = `In Erinnerungen angelegt (${sub(t.subjectKey).name})`;
      } catch (e) { msg = 'Lokal gespeichert – Übertragung an Erinnerungen fehlgeschlagen'; }
    }
    setToast({ msg, link: cfg.shortcut ? shortcutUrl(t) : null });
  };

  const importJson = (text) => {
    let json;
    try { json = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { setToast({ msg: 'Ungültiges JSON', error: true }); return false; }
    try {
      const res = parseTimetable(json, mapping, cfg.elementId);
      setRaw(json); setMode('import');
      const unk = res.diag.bySource.unbekannt || 0;
      setConn((c) => ({ ...c, webuntis: { state: 'import', msg: `${res.lessons.length} Stunden importiert (${deDay(res.diag.from, { day: 'numeric', month: 'numeric' })}–${deDay(res.diag.to, { day: 'numeric', month: 'numeric' })})${unk ? ` · ${unk} ohne erkennbares Fach` : ''}` } }));
      setWeekStart(mondayOf(parseD(res.diag.from)));
      setToast({ msg: `${res.lessons.length} Stunden importiert${unk ? ' – bitte fehlende Fächer zuordnen' : ''}` });
      return true;
    } catch (e) {
      setToast({ msg: e.message, error: true }); return false;
    }
  };

  const loadLive = async (date = weekStart, { silent = false } = {}) => {
    if (!cfg.backend.trim()) {
      if (!silent) setToast({ msg: 'Bitte zuerst die Backend-URL in den Einstellungen eintragen.', error: true });
      return false;
    }
    const targetWeek = mondayOf(typeof date === 'string' ? parseD(date) : date);
    const key = fmt(targetWeek);
    if (inFlightWeeks.current.has(key)) return false;
    inFlightWeeks.current.add(key);
    setLoadingWeeks((x) => ({ ...x, [key]: true }));
    if (!silent) setConn((c) => ({ ...c, webuntis: { state: 'loading', msg: `Lade KW ${isoWeek(targetWeek)} …` } }));
    try {
      const qs = new URLSearchParams({ school: cfg.school, elementType: cfg.elementType, elementId: cfg.elementId, date: key });
      const r = await fetch(`${cfg.backend.replace(/\/+$/, '')}/api/webuntis/week?${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const res = parseTimetable(j, mapping, cfg.elementId);
      setLiveWeeks((x) => ({ ...x, [key]: res.lessons }));
      setLiveSubjects((x) => ({ ...x, ...res.custom }));
      setMode('live');
      setConn((c) => ({ ...c, webuntis: { state: 'live', msg: `KW ${isoWeek(targetWeek)} aktualisiert · ${res.lessons.length} Stunden · ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` } }));
      if (!silent) setToast({ msg: `KW ${isoWeek(targetWeek)} live aktualisiert` });
    } catch (e) {
      setConn((c) => ({ ...c, webuntis: { state: 'error', msg: `KW ${isoWeek(targetWeek)} konnte nicht geladen werden (${e.message}). Backend-URL und Render-Dienst prüfen.` } }));
    }
    setLoadingWeeks((x) => ({ ...x, [key]: false }));
    inFlightWeeks.current.delete(key);
  };

  const onWeekChange = (date) => {
    const target = mondayOf(date);
    setWeekStart(target);
    if (cfg.backend.trim() && mode !== 'demo') loadLive(target, { silent: true });
  };

  // Sobald die Backend-URL eingetragen ist: aktuelle Woche und drei Folgewochen automatisch laden.
  // Weitere Wochen werden beim Blättern nachgeladen; es gibt keine feste Zwei-Wochen-Grenze.
  useEffect(() => {
    if (!cfg.backend.trim()) return undefined;
    let stopped = false;
    const syncHorizon = async () => {
      const start = mondayOf(new Date());
      for (let i = 0; i < 4 && !stopped; i++) await loadLive(addDays(start, i * 7), { silent: true });
    };
    const timer = setTimeout(syncHorizon, 700);
    const interval = setInterval(syncHorizon, 15 * 60 * 1000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(interval); };
  }, [cfg.backend, cfg.school, cfg.elementType, cfg.elementId, mapping]);

  const syncReminders = async () => {
    setConn((c) => ({ ...c, reminders: { state: 'loading', msg: '' } }));
    try {
      const r = await fetch(`${cfg.backend.replace(/\/+$/, '')}/api/reminders`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const arr = await r.json();
      const mapped = arr.map((x) => {
        const tag = (x.title.match(/#(\w+)/) || [])[1];
        const k = matchSubject(x.list || '', 'text') || (tag && matchSubject(tag, 'exact')) || 'unbekannt';
        return { id: `rem-${x.id}`, title: x.title.replace(/#\w+/g, '').trim(), subjectKey: k, due: x.dueDate ? x.dueDate.slice(0, 10) : null,
          dueTime: x.dueDate && x.dueDate.length > 10 ? x.dueDate.slice(11, 16) : null, done: !!x.completed, priority: x.priority || 0, notes: x.notes || '', source: 'erinnerungen' };
      });
      setTasks((ts) => [...ts.filter((t) => t.source !== 'erinnerungen'), ...mapped]);
      setConn((c) => ({ ...c, reminders: { state: 'live', msg: `${mapped.length} Erinnerungen synchronisiert` } }));
    } catch (e) {
      setConn((c) => ({ ...c, reminders: { state: 'error', msg: `Abruf fehlgeschlagen (${e.message}). Das Backend braucht eine native/Kurzbefehl-Quelle für Erinnerungen.` } }));
    }
  };

  const useDemo = () => { setMode('demo'); setRaw(null); setConn((c) => ({ ...c, webuntis: { state: 'demo', msg: '' } })); setWeekStart(mondayOf(now)); };
  const loadSample = () => { setMapping({}); importJson(buildSampleWebUntis(mondayOf(now), Number(cfg.elementId) || 1669)); };

  const titles = { heute: 'Heute', woche: 'Woche', aufgaben: 'Aufgaben', einstellungen: 'Einstellungen' };
  const sourceTone = mode === 'demo' ? ['yellow', 'Demo'] : mode === 'live' ? ['green', 'Live'] : ['blue', 'Import'];
  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="ua min-h-screen md:flex">
      <style>{CSS}</style>

      {/* Seitenleiste – iPad/Desktop */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 sidebar sticky top-0 h-screen p-3">
        <div className="flex items-center gap-2.5 px-2 pt-2 pb-4">
          <div className="appicon tone-blue"><Icon n="week" s={18} w={2} /></div>
          <div><div className="text-[15px] font-semibold leading-tight">Stundenplan</div><div className="text-[12px] sec">Schule {cfg.school}</div></div>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Hauptnavigation">
          {NAV.map((n) => (
            <button key={n.id} className="navitem" aria-current={tab === n.id ? 'page' : undefined} onClick={() => setTab(n.id)}>
              <Icon n={n.icon} s={19} /> <span className="flex-1 text-left">{n.label}</span>
              {n.id === 'aufgaben' && <span className="text-[13px] sec tabular-nums">{openCount}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto card p-3 text-[12.5px] leading-snug">
          <div className="flex items-center justify-between"><span className="font-medium">Datenquelle</span><Pill tone={sourceTone[0]}>{sourceTone[1]}</Pill></div>
          <div className="sec mt-1">Erinnerungen: {conn.reminders.state === 'live' ? 'verbunden' : 'lokal'}</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 blur hairline">
          <div className="max-w-5xl mx-auto px-4 md:px-6 pt-3 pb-2.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium sec uppercase tracking-wide">
                {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                {simDate && <span style={{ color: 'var(--orange)' }}> · simuliert {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
              <h1 className="text-[28px] md:text-[30px] font-bold tracking-tight leading-tight">{titles[tab]}</h1>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span className="md:hidden"><Pill tone={sourceTone[0]}>{sourceTone[1]}</Pill></span>
              <button className="addbtn" onClick={() => openAdd()} aria-label="Neue Aufgabe"><Icon n="plus" s={20} w={2.6} /></button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 md:px-6 pt-4 pb-28 md:pb-10">
          {mode === 'demo' && tab !== 'einstellungen' && (
            <button className="demobar w-full text-left mb-4" onClick={() => setTab('einstellungen')}>
              <Icon n="info" s={17} className="shrink-0" />
              <span className="flex-1"><b>Demo-Daten.</b> WebUntis und Apple Erinnerungen sind noch nicht verbunden.</span>
              <span className="font-semibold whitespace-nowrap">Einrichten <Icon n="chevR" s={13} w={2.4} className="inline -mt-0.5" /></span>
            </button>
          )}
          {mode === 'import' && tab !== 'einstellungen' && (
            <button className="demobar importbar w-full text-left mb-4" onClick={() => setTab('einstellungen')}>
              <Icon n="info" s={17} className="shrink-0" />
              <span className="flex-1"><b>WebUntis-Import · Klasse 10b.</b> KW 46–47, abgerufen am 10.11.2026. Momentaufnahme – nicht live aktualisiert; Lehrkräfte waren in der öffentlichen Antwort nicht enthalten.</span>
              <span className="font-semibold whitespace-nowrap">Details <Icon n="chevR" s={13} w={2.4} className="inline -mt-0.5" /></span>
            </button>
          )}
          {mode !== 'demo' && parsed && parsed.ok && (parsed.diag.bySource.unbekannt || 0) > 0 && tab !== 'einstellungen' && (
            <button className="demobar warn w-full text-left mb-4" onClick={() => setTab('einstellungen')}>
              <Icon n="warn" s={17} className="shrink-0" />
              <span className="flex-1">{parsed.diag.courses.filter((c) => c.source === 'unbekannt').length} Kurse ohne erkennbares Fach – jetzt zuordnen.</span>
              <Icon n="chevR" s={14} w={2.4} />
            </button>
          )}

          {tab === 'heute' && <TodayView lessons={lessons} now={now} tasks={tasks} onOpenLesson={setDetail} onToggle={toggle} onDelete={remove} onQuickAdd={openAdd} />}
          {tab === 'woche' && <WeekView lessons={lessons} now={now} weekStart={weekStart} onWeekChange={onWeekChange} tasks={tasks} onOpenLesson={setDetail} mode={mode} loadingWeek={!!loadingWeeks[fmt(weekStart)]} />}
          {tab === 'aufgaben' && <TasksView tasks={tasks} lessons={lessons} now={now} onToggle={toggle} onDelete={remove} onQuickAdd={openAdd} subjectOrder={subjectOrder} />}
          {tab === 'einstellungen' && (
            <SettingsView cfg={cfg} setCfg={setCfg} conn={conn} mode={mode} diag={parsed && parsed.ok ? parsed.diag : null}
              parseError={parsed && !parsed.ok ? parsed.error : null} mapping={mapping} setMapping={setMapping} subjects={subjects}
              onImport={importJson} onLoadLive={loadLive} onSyncReminders={syncReminders} onUseDemo={useDemo} onSample={loadSample}
              sim={sim} setSim={setSim} weekStart={weekStart}
              onClearDemoTasks={() => { setTasks((ts) => ts.filter((t) => t.source !== 'demo')); setToast({ msg: 'Demo-Aufgaben entfernt' }); }} />
          )}
        </main>

        {/* Tab-Leiste – Telefon */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 blur hairline-top tabbar" aria-label="Hauptnavigation">
          {NAV.map((n) => (
            <button key={n.id} aria-current={tab === n.id ? 'page' : undefined} onClick={() => setTab(n.id)}>
              <span className="relative"><Icon n={n.icon} s={24} w={1.7} />
                {n.id === 'aufgaben' && openCount > 0 && <span className="tabbadge">{openCount}</span>}</span>
              <span>{n.label === 'Einstellungen' ? 'Mehr' : n.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <Sheet open={!!addOpen} onClose={() => setAddOpen(null)} title="Neue Aufgabe">
        {addOpen && <QuickAdd key={addOpen.n} lessons={lessons} now={now} defaultSubject={addOpen.k} subjectOrder={subjectOrder} onSave={saveTask} onCancel={() => setAddOpen(null)} />}
      </Sheet>
      <Sheet open={!!detail} onClose={() => setDetail(null)} title="Stunde">
        {detail && <LessonDetail l={detail} tasks={tasks} now={now} onToggle={toggle} onDelete={remove} onAdd={openAdd} />}
      </Sheet>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast.error ? <Icon n="warn" s={17} className="shrink-0" style={{}} /> : <Icon n="check" s={17} w={2.4} className="shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          {toast.undo && <button className="font-semibold" style={{ color: '#64D2FF' }} onClick={() => { toast.undo(); setToast(null); }}>Rückgängig</button>}
          {toast.link && <a className="font-semibold whitespace-nowrap" style={{ color: '#64D2FF' }} href={toast.link}>In Erinnerungen</a>}
        </div>
      )}
    </div>
  );
}

/* ======================= Stile ======================= */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
.ua{--bg:#F2F2F7;--card:#fff;--card2:#F2F2F7;--label:#000;--sec:rgba(60,60,67,.62);--ter:rgba(60,60,67,.3);--sep:rgba(60,60,67,.16);
--fill:rgba(120,120,128,.12);--fill2:rgba(120,120,128,.2);--tint:#007AFF;--bar:rgba(242,242,247,.82);--red:#FF3B30;--green:#34C759;--orange:#FF9500;
--segon:#fff;--shadow:0 1px 2px rgba(0,0,0,.04),0 0 0 .5px rgba(0,0,0,.03);
font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,sans-serif;background:var(--bg);color:var(--label);
-webkit-font-smoothing:antialiased;letter-spacing:-.01em;color-scheme:light dark;-webkit-tap-highlight-color:transparent}
@media (prefers-color-scheme:dark){.ua{--bg:#000;--card:#1C1C1E;--card2:#2C2C2E;--label:#fff;--sec:rgba(235,235,245,.6);--ter:rgba(235,235,245,.3);
--sep:rgba(84,84,88,.55);--fill:rgba(118,118,128,.24);--fill2:rgba(118,118,128,.34);--tint:#0A84FF;--bar:rgba(10,10,12,.78);--red:#FF453A;--green:#30D158;--orange:#FF9F0A;--segon:#636366;--shadow:none}
.ua .ink{color:var(--c)!important}}
.ua button,.ua input,.ua select,.ua textarea{font:inherit;color:inherit}
.ua button:disabled{opacity:.4;cursor:default}
.ua :focus-visible{outline:2.5px solid var(--tint);outline-offset:2px;border-radius:8px}
.sec{color:var(--sec)} .ter{color:var(--ter)} .ink{color:var(--ink)} .ink-tint{color:var(--tint)}
.mono{font-family:ui-monospace,"SF Mono","JetBrains Mono",monospace}
.card{background:var(--card);border-radius:14px;box-shadow:var(--shadow)}
.card-inset{background:var(--card2);border-radius:12px}
.sec-title{font-size:12.5px;font-weight:500;text-transform:uppercase;letter-spacing:.02em;color:var(--sec)}
.row+.row{box-shadow:inset 0 .5px 0 var(--sep)}
ul>.row+.row{box-shadow:none;border-top:.5px solid var(--sep)}
.rowbtn{transition:background .15s}.rowbtn:hover{background:var(--fill)}.rowbtn:active{background:var(--fill2)}
.rowbtn.is-past{opacity:.48}
.rowbtn.is-live{background:color-mix(in srgb,var(--c) 10%,transparent)}
.blur{background:var(--bar);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px)}
.hairline{box-shadow:0 .5px 0 var(--sep)} .hairline-top{box-shadow:0 -.5px 0 var(--sep)}
.sidebar{background:var(--card2);border-right:.5px solid var(--sep)}
@media (prefers-color-scheme:dark){.sidebar{background:#0d0d0f}}
.navitem{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;font-size:15px;font-weight:500}
.navitem:hover{background:var(--fill)}
.navitem[aria-current=page]{background:var(--tint);color:#fff}.navitem[aria-current=page] .sec{color:rgba(255,255,255,.8)}
.tabbar{display:flex;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
.tabbar button{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:10.5px;font-weight:500;color:var(--sec);padding:2px 0}
.tabbar button[aria-current=page]{color:var(--tint)}
.tabbadge{position:absolute;top:-4px;right:-10px;background:var(--red);color:#fff;font-size:10.5px;font-weight:600;min-width:17px;height:17px;border-radius:9px;display:grid;place-items:center;padding:0 4px}
.addbtn{width:36px;height:36px;border-radius:50%;background:var(--tint);color:#fff;display:grid;place-items:center;box-shadow:0 2px 8px color-mix(in srgb,var(--tint) 40%,transparent);transition:transform .15s}
.addbtn:active{transform:scale(.92)}
.iconbtn{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;flex-shrink:0}
.iconbtn.round{border-radius:50%;background:var(--fill);color:var(--sec)}
.iconbtn.ghost{color:var(--ter)}.iconbtn.ghost:hover{color:var(--red);background:var(--fill)}
.linkbtn{color:var(--tint);font-size:15px;font-weight:500;display:flex;align-items:center}
.btn-tint{background:var(--tint);color:#fff!important;border-radius:11px;font-weight:600;transition:filter .15s,transform .1s}
.btn-tint:hover:not(:disabled){filter:brightness(1.08)}.btn-tint:active:not(:disabled){transform:scale(.98)}
.btn-fill{background:var(--fill);color:var(--tint)!important;border-radius:11px;font-weight:600;padding:6px 12px}
.btn-fill:hover:not(:disabled){background:var(--fill2)}
.seg{display:flex;background:var(--fill);border-radius:9px;padding:2px;gap:2px}
.seg button{flex:1;border-radius:7px;padding:6px 8px;font-size:13.5px;font-weight:500;white-space:nowrap;transition:background .15s}
.seg-sm button{padding:5px 6px;font-size:13px}
.seg button[aria-pressed=true]{background:var(--segon);font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.1),0 0 0 .5px rgba(0,0,0,.04)}
.chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.chips::-webkit-scrollbar{display:none}
.chips.wrap{flex-wrap:wrap;overflow:visible}
.chip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--card);font-size:13.5px;font-weight:500;white-space:nowrap;box-shadow:inset 0 0 0 .5px var(--sep);--c:var(--tint)}
.chip[aria-pressed=true]{background:color-mix(in srgb,var(--c) 20%,var(--card));box-shadow:inset 0 0 0 1.5px var(--c)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--c);display:inline-block}.dot-lg{width:10px;height:10px}
.pill{display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}
.pill-yellow{background:rgba(255,204,0,.22);color:#8A6A00}.pill-blue{background:rgba(0,122,255,.13);color:var(--tint)}
.pill-green{background:rgba(52,199,89,.16);color:#248A3D}.pill-red{background:rgba(255,59,48,.13);color:var(--red)}.pill-gray{background:var(--fill);color:var(--sec)}
@media (prefers-color-scheme:dark){.pill-yellow{color:#FFD60A}.pill-green{color:#30D158}}
.mini{font-size:10.5px;font-weight:600;padding:0 5px;border-radius:4px;background:var(--fill);color:var(--sec);line-height:16px}
.mini-demo{background:rgba(255,204,0,.22);color:#8A6A00}
@media (prefers-color-scheme:dark){.mini-demo{color:#FFD60A}}
.tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;border:1px solid;border-radius:5px;padding:0 5px;line-height:16px}
.live{font-size:10.5px;font-weight:700;color:var(--on,#fff);background:var(--c);border-radius:5px;padding:0 6px;line-height:17px;text-transform:uppercase}
.badge{min-width:22px;height:22px;border-radius:11px;background:var(--c,var(--tint));color:var(--on,#fff);font-size:12px;font-weight:700;display:grid;place-items:center;padding:0 6px}
.badge-sm{min-width:17px;height:17px;font-size:10.5px;padding:0 4px}
.check{width:22px;height:22px;border-radius:50%;border:1.7px solid var(--c);flex-shrink:0;display:grid;place-items:center;transition:background .15s}
.check.on{background:var(--c);color:var(--on)}
.check:hover:not(.on){background:color-mix(in srgb,var(--c) 15%,transparent)}
.nowcard{position:relative;overflow:hidden;transition:transform .15s}
.nowcard::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 22%,transparent),transparent 65%);pointer-events:none}
.nowcard>*{position:relative}.nowcard:active{transform:scale(.99)}
.progress{height:6px;border-radius:3px;background:var(--fill2);overflow:hidden}.progress>div{height:100%;background:var(--c);border-radius:3px;transition:width .6s}
.tintbg{background:color-mix(in srgb,var(--c) 18%,var(--card))}
.demobar{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;font-size:13.5px;line-height:1.35;
background:rgba(255,204,0,.18);color:#6B5300;box-shadow:inset 0 0 0 .5px rgba(255,204,0,.5)}
.demobar.importbar{background:rgba(0,122,255,.1);color:#005BB5;box-shadow:inset 0 0 0 .5px rgba(0,122,255,.28)}
@media (prefers-color-scheme:dark){.demobar.importbar{background:rgba(10,132,255,.16);color:#64D2FF;box-shadow:inset 0 0 0 .5px rgba(10,132,255,.36)}}
.demobar.warn{background:rgba(255,149,0,.14);color:#A04A00;box-shadow:inset 0 0 0 .5px rgba(255,149,0,.45)}
@media (prefers-color-scheme:dark){.demobar{color:#FFD60A}.demobar.warn{color:#FF9F0A}}
.search{display:flex;align-items:center;gap:6px;background:var(--fill);border-radius:10px;padding:7px 10px}
.search input{flex:1;background:transparent;outline:none;font-size:16px;min-width:0}
.inp{width:100%;background:var(--fill);border-radius:9px;padding:7px 10px;font-size:15px;outline:none;border:0}
.inp:focus{box-shadow:0 0 0 2px var(--tint)}
.inp-sm{padding:5px 8px;font-size:13.5px}.inp-lg{font-size:18px;padding:11px 12px;font-weight:500}
textarea.inp{resize:vertical;font-size:13px}
.code{font-family:ui-monospace,"SF Mono",monospace;font-size:11px;background:var(--fill);padding:1px 4px;border-radius:4px}
.switch{appearance:none;-webkit-appearance:none;width:51px;height:31px;border-radius:16px;background:var(--fill2);position:relative;transition:background .2s;cursor:pointer;flex-shrink:0}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.2);transition:transform .2s}
.switch:checked{background:var(--green)}.switch:checked::after{transform:translateX(20px)}
.appicon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:#fff;flex-shrink:0}
.tone-yellow{background:#FFCC00;color:#3A2E00}.tone-blue{background:#007AFF}.tone-green{background:#34C759}.tone-red{background:#FF3B30}.tone-gray{background:#8E8E93}
.daypick{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.daypick button{display:flex;flex-direction:column;align-items:center;padding:6px 0 5px;border-radius:12px;background:var(--card);box-shadow:var(--shadow);color:var(--sec)}
.daypick button .text-\\[17px\\]{color:var(--label)}
.daypick button.is-today{color:var(--tint)}
.daypick button[aria-selected=true]{background:var(--tint);color:rgba(255,255,255,.85)}
.daypick button[aria-selected=true] span{color:#fff}
.dots{display:flex;gap:2px;height:5px;margin-top:3px}.dots i{width:5px;height:5px;border-radius:50%}
.daynum{font-size:18px;font-weight:600;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;margin:1px auto 0}
.daynum.is-today{background:var(--tint);color:#fff}
.daycol{border-left:.5px solid var(--sep)}.daycol.is-today{background:color-mix(in srgb,var(--tint) 4%,transparent)}
.hline{position:absolute;left:0;right:0;border-top:.5px solid var(--sep)}
.blk{position:absolute;left:3px;right:3px;border-radius:7px;text-align:left;padding:4px 6px;overflow:hidden;
background:color-mix(in srgb,var(--c) 17%,var(--card));border-left:3px solid var(--c);transition:filter .15s,transform .1s}
.blk:hover{filter:brightness(.97)}.blk:active{transform:scale(.98)}
.blk.is-cancel{opacity:.55;background:repeating-linear-gradient(135deg,var(--fill),var(--fill) 5px,transparent 5px,transparent 10px)}
.blk.is-cancel span{text-decoration:line-through}
.nowline{position:absolute;left:-4px;right:0;height:2px;background:var(--red);z-index:2}
.nowline::before{content:"";position:absolute;left:0;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--red)}
.overlay{background:rgba(0,0,0,.32);animation:fade .2s}
.sheet{background:var(--card);border-radius:14px 14px 0 0;animation:up .28s cubic-bezier(.2,.9,.3,1);padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -10px 40px rgba(0,0,0,.18)}
@media (min-width:768px){.sheet{border-radius:16px;animation:pop .22s cubic-bezier(.2,.9,.3,1)}}
@media (prefers-color-scheme:dark){.sheet{background:#1C1C1E}}
.grabber{width:36px;height:5px;border-radius:3px;background:var(--fill2);margin:6px auto 0}
.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:10px;
background:rgba(30,30,32,.94);color:#fff;padding:10px 14px;border-radius:14px;font-size:14px;width:min(92vw,440px);box-shadow:0 8px 30px rgba(0,0,0,.25);animation:up .25s}
@media (min-width:768px){.toast{bottom:24px}}
@keyframes up{from{transform:translateY(16px);opacity:0}}
@keyframes pop{from{transform:scale(.96);opacity:0}}
@keyframes fade{from{opacity:0}}
.toast{animation-name:toastup}@keyframes toastup{from{transform:translate(-50%,12px);opacity:0}}
@media (prefers-reduced-motion:reduce){.ua *,.ua *::before,.ua *::after{animation:none!important;transition:none!important}}
`;
