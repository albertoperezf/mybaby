// Vaccine schedules as data. Ages are in months (halves allowed); each dose has a recommended window [from, to].
// Sources: CDC Child and Adolescent Immunization Schedule (birth-18 months view, July 2025 version, which CDC
// lists as current while a court stay on later changes applies) and the AEP (Spanish Association of Pediatrics)
// 2026 systematic schedule. Regional and individual schedules differ: the app always tells users to confirm.
import type { VaccineScheduleId } from "@/db/types";

type L10n = { en: string; es: string };

export interface VaccineInfo {
  name: L10n;
  protects: L10n;
}

export const VACCINES: Record<string, VaccineInfo> = {
  hepb: { name: { en: "Hepatitis B", es: "Hepatitis B" }, protects: { en: "Hepatitis B, a liver infection", es: "Hepatitis B, una infección del hígado" } },
  hexa: {
    name: { en: "Hexavalent (6-in-1)", es: "Hexavalente (6 en 1)" },
    protects: {
      en: "Diphtheria, tetanus, whooping cough, polio, Hib and hepatitis B in one injection",
      es: "Difteria, tétanos, tosferina, polio, Hib y hepatitis B en una sola inyección",
    },
  },
  dtap: {
    name: { en: "DTaP", es: "DTPa" },
    protects: { en: "Diphtheria, tetanus and whooping cough (pertussis)", es: "Difteria, tétanos y tosferina" },
  },
  hib: { name: { en: "Hib", es: "Hib" }, protects: { en: "Haemophilus influenzae type b: meningitis, pneumonia", es: "Haemophilus influenzae tipo b: meningitis, neumonía" } },
  pcv: {
    name: { en: "Pneumococcal (PCV)", es: "Neumococo (VNC)" },
    protects: { en: "Pneumococcal meningitis, pneumonia and blood infections", es: "Meningitis, neumonía e infecciones de la sangre por neumococo" },
  },
  ipv: { name: { en: "Polio (IPV)", es: "Polio (VPI)" }, protects: { en: "Polio", es: "Poliomielitis" } },
  rv: { name: { en: "Rotavirus", es: "Rotavirus" }, protects: { en: "Severe diarrhea and dehydration", es: "Diarrea grave y deshidratación" } },
  rsv: {
    name: { en: "RSV antibody (nirsevimab or similar)", es: "Anticuerpo frente al VRS (nirsevimab)" },
    protects: { en: "Severe RSV bronchiolitis and pneumonia in the first RSV season", es: "Bronquiolitis y neumonía graves por VRS en la primera temporada" },
  },
  flu: { name: { en: "Influenza (flu)", es: "Gripe" }, protects: { en: "Seasonal flu", es: "Gripe estacional" } },
  covid: { name: { en: "COVID-19", es: "COVID-19" }, protects: { en: "COVID-19", es: "COVID-19" } },
  mmr: {
    name: { en: "MMR (measles, mumps, rubella)", es: "Triple vírica (sarampión, rubéola, parotiditis)" },
    protects: { en: "Measles, mumps and rubella", es: "Sarampión, rubéola y parotiditis" },
  },
  var: { name: { en: "Varicella (chickenpox)", es: "Varicela" }, protects: { en: "Chickenpox", es: "Varicela" } },
  hepa: { name: { en: "Hepatitis A", es: "Hepatitis A" }, protects: { en: "Hepatitis A, a liver infection", es: "Hepatitis A, una infección del hígado" } },
  menb: { name: { en: "Meningococcal B", es: "Meningococo B" }, protects: { en: "Meningococcal B meningitis and sepsis", es: "Meningitis y sepsis por meningococo B" } },
  menacwy: {
    name: { en: "Meningococcal ACWY", es: "Meningococo ACWY" },
    protects: { en: "Meningococcal A, C, W and Y meningitis and sepsis", es: "Meningitis y sepsis por meningococo A, C, W e Y" },
  },
};

export interface DoseTemplate {
  /** Stable key, unique within a schedule. */
  code: string;
  vaccine: string;
  dose: number;
  from: number;
  to: number;
  after?: string;
  minGapDays?: number;
  optional?: boolean;
  note?: L10n;
}

export interface ScheduleDef {
  id: VaccineScheduleId;
  name: L10n;
  source: L10n;
  url: string;
  reviewed: string;
  doses: DoseTemplate[];
  notes: L10n[];
}

const WEEK = 7;

const season: L10n = {
  en: "Seasonal: depends on your baby's birth month and the local RSV season. Ask your pediatrician.",
  es: "Estacional: depende del mes de nacimiento y de la temporada de VRS. Consulta a tu pediatra.",
};
const brand: L10n = {
  en: "Only needed with some vaccine brands. Your pediatrician will tell you.",
  es: "Solo se necesita con algunas marcas de vacuna. Tu pediatra te lo indicará.",
};
const fluNote: L10n = {
  en: "Given every autumn from 6 months old. Babies getting it for the first time may need 2 doses 4 weeks apart.",
  es: "Se administra cada otoño desde los 6 meses. Si es la primera vez, puede necesitar 2 dosis separadas 4 semanas.",
};

export const US_SCHEDULE: ScheduleDef = {
  id: "us",
  name: { en: "United States (CDC / AAP)", es: "Estados Unidos (CDC / AAP)" },
  source: { en: "CDC Child and Adolescent Immunization Schedule (July 2025 version)", es: "Calendario de vacunación infantil y adolescente de los CDC (versión de julio de 2025)" },
  url: "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html",
  reviewed: "2026-11",
  doses: [
    { code: "hepb-1", vaccine: "hepb", dose: 1, from: 0, to: 1 },
    { code: "hepb-2", vaccine: "hepb", dose: 2, from: 1, to: 2, after: "hepb-1", minGapDays: 4 * WEEK },
    { code: "hepb-3", vaccine: "hepb", dose: 3, from: 6, to: 18, after: "hepb-2", minGapDays: 8 * WEEK },
    { code: "rsv-1", vaccine: "rsv", dose: 1, from: 0, to: 8, optional: true, note: season },
    { code: "rv-1", vaccine: "rv", dose: 1, from: 2, to: 3.5 },
    { code: "rv-2", vaccine: "rv", dose: 2, from: 4, to: 6, after: "rv-1", minGapDays: 4 * WEEK },
    { code: "rv-3", vaccine: "rv", dose: 3, from: 6, to: 8, optional: true, after: "rv-2", minGapDays: 4 * WEEK, note: brand },
    { code: "dtap-1", vaccine: "dtap", dose: 1, from: 2, to: 3 },
    { code: "dtap-2", vaccine: "dtap", dose: 2, from: 4, to: 5, after: "dtap-1", minGapDays: 4 * WEEK },
    { code: "dtap-3", vaccine: "dtap", dose: 3, from: 6, to: 7, after: "dtap-2", minGapDays: 4 * WEEK },
    { code: "dtap-4", vaccine: "dtap", dose: 4, from: 15, to: 18, after: "dtap-3", minGapDays: 182 },
    { code: "dtap-5", vaccine: "dtap", dose: 5, from: 48, to: 72 },
    { code: "hib-1", vaccine: "hib", dose: 1, from: 2, to: 3 },
    { code: "hib-2", vaccine: "hib", dose: 2, from: 4, to: 5, after: "hib-1", minGapDays: 4 * WEEK },
    { code: "hib-3", vaccine: "hib", dose: 3, from: 6, to: 7, optional: true, after: "hib-2", minGapDays: 4 * WEEK, note: brand },
    { code: "hib-4", vaccine: "hib", dose: 4, from: 12, to: 15 },
    { code: "pcv-1", vaccine: "pcv", dose: 1, from: 2, to: 3 },
    { code: "pcv-2", vaccine: "pcv", dose: 2, from: 4, to: 5, after: "pcv-1", minGapDays: 4 * WEEK },
    { code: "pcv-3", vaccine: "pcv", dose: 3, from: 6, to: 7, after: "pcv-2", minGapDays: 4 * WEEK },
    { code: "pcv-4", vaccine: "pcv", dose: 4, from: 12, to: 15 },
    { code: "ipv-1", vaccine: "ipv", dose: 1, from: 2, to: 3 },
    { code: "ipv-2", vaccine: "ipv", dose: 2, from: 4, to: 5, after: "ipv-1", minGapDays: 4 * WEEK },
    { code: "ipv-3", vaccine: "ipv", dose: 3, from: 6, to: 18, after: "ipv-2", minGapDays: 4 * WEEK },
    { code: "ipv-4", vaccine: "ipv", dose: 4, from: 48, to: 72 },
    { code: "flu-1", vaccine: "flu", dose: 1, from: 6, to: 12, optional: true, note: fluNote },
    {
      code: "covid-1",
      vaccine: "covid",
      dose: 1,
      from: 6,
      to: 24,
      optional: true,
      note: {
        en: "US guidance for COVID-19 vaccines in young children is based on individual decision-making with your pediatrician.",
        es: "En EE. UU., la vacuna de la COVID-19 en niños pequeños se decide de forma individual con el pediatra.",
      },
    },
    { code: "mmr-1", vaccine: "mmr", dose: 1, from: 12, to: 15 },
    { code: "var-1", vaccine: "var", dose: 1, from: 12, to: 15 },
    { code: "hepa-1", vaccine: "hepa", dose: 1, from: 12, to: 23 },
    { code: "hepa-2", vaccine: "hepa", dose: 2, from: 18, to: 29, after: "hepa-1", minGapDays: 182 },
    { code: "mmr-2", vaccine: "mmr", dose: 2, from: 48, to: 72, after: "mmr-1", minGapDays: 4 * WEEK },
    { code: "var-2", vaccine: "var", dose: 2, from: 48, to: 72, after: "var-1", minGapDays: 91 },
  ],
  notes: [
    {
      en: "US recommendations have been under legal review recently. This checklist follows the CDC schedule that CDC lists as current. Ask your pediatrician which doses they recommend.",
      es: "Las recomendaciones de EE. UU. han estado en revisión legal. Esta lista sigue el calendario que los CDC indican como vigente. Pregunta a tu pediatra qué dosis recomienda.",
    },
    { en: "Doses from 4 years old are shown for completeness.", es: "Las dosis a partir de los 4 años se muestran para tener la serie completa." },
  ],
};

export const ES_SCHEDULE: ScheduleDef = {
  id: "es",
  name: { en: "Spain (AEP)", es: "España (AEP)" },
  source: { en: "AEP (Spanish Association of Pediatrics) 2026 systematic schedule", es: "Calendario sistemático 2026 del Comité Asesor de Vacunas de la AEP" },
  url: "https://vacunasaep.org/profesionales/calendario-de-vacunaciones-e-inmunizaciones-aep-2026",
  reviewed: "2026-11",
  doses: [
    {
      code: "rsv-1",
      vaccine: "rsv",
      dose: 1,
      from: 0,
      to: 6,
      optional: true,
      note: {
        en: "Nirsevimab: for babies born in the RSV season (October to March), and for babies under 6 months at the start of the season.",
        es: "Nirsevimab: para recién nacidos en la temporada de VRS (octubre a marzo) y menores de 6 meses al inicio de la temporada.",
      },
    },
    { code: "hexa-1", vaccine: "hexa", dose: 1, from: 2, to: 3 },
    { code: "hexa-2", vaccine: "hexa", dose: 2, from: 4, to: 5, after: "hexa-1", minGapDays: 8 * WEEK },
    { code: "hexa-3", vaccine: "hexa", dose: 3, from: 11, to: 13, after: "hexa-2", minGapDays: 122 },
    { code: "pcv-1", vaccine: "pcv", dose: 1, from: 2, to: 3 },
    { code: "pcv-2", vaccine: "pcv", dose: 2, from: 4, to: 5, after: "pcv-1", minGapDays: 8 * WEEK },
    {
      code: "pcv-3",
      vaccine: "pcv",
      dose: 3,
      from: 11,
      to: 13,
      after: "pcv-2",
      minGapDays: 8 * WEEK,
      note: {
        en: "With the 20-valent vaccine the schedule has an extra dose at 6 months (2, 4, 6 and 11 months).",
        es: "Con la vacuna de 20 serotipos la pauta lleva una dosis más a los 6 meses (2, 4, 6 y 11 meses).",
      },
    },
    { code: "rv-1", vaccine: "rv", dose: 1, from: 1.5, to: 3, note: { en: "Start between 6 and 12 weeks of age.", es: "Debe empezar entre las 6 y las 12 semanas de vida." } },
    { code: "rv-2", vaccine: "rv", dose: 2, from: 3, to: 5.5, after: "rv-1", minGapDays: 4 * WEEK, note: { en: "Must be completed before 24 weeks (single-strain brand).", es: "Debe completarse antes de las 24 semanas (vacuna monovalente)." } },
    { code: "rv-3", vaccine: "rv", dose: 3, from: 5, to: 7.5, optional: true, after: "rv-2", minGapDays: 4 * WEEK, note: brand },
    { code: "menb-1", vaccine: "menb", dose: 1, from: 2, to: 3 },
    { code: "menb-2", vaccine: "menb", dose: 2, from: 4, to: 5, after: "menb-1", minGapDays: 8 * WEEK },
    { code: "menb-3", vaccine: "menb", dose: 3, from: 12, to: 15, after: "menb-2", minGapDays: 182 },
    {
      code: "menacwy-1",
      vaccine: "menacwy",
      dose: 1,
      from: 4,
      to: 5,
      optional: true,
      note: {
        en: "In the public calendar only in some regions; the AEP recommends it. Check your region.",
        es: "En el calendario financiado solo en algunas comunidades; la AEP la recomienda. Consulta la tuya.",
      },
    },
    { code: "menacwy-2", vaccine: "menacwy", dose: 2, from: 12, to: 13, optional: true, after: "menacwy-1", minGapDays: 8 * WEEK },
    { code: "flu-1", vaccine: "flu", dose: 1, from: 6, to: 12, optional: true, note: fluNote },
    { code: "mmr-1", vaccine: "mmr", dose: 1, from: 12, to: 15 },
    { code: "var-1", vaccine: "var", dose: 1, from: 15, to: 18 },
    { code: "hepa-1", vaccine: "hepa", dose: 1, from: 12, to: 15, optional: true, note: { en: "Single dose recommended by the AEP; not in every regional calendar.", es: "Dosis única recomendada por la AEP; no está en todos los calendarios autonómicos." } },
    { code: "mmr-2", vaccine: "mmr", dose: 2, from: 24, to: 27, after: "mmr-1", minGapDays: 4 * WEEK },
    { code: "var-2", vaccine: "var", dose: 2, from: 24, to: 27, after: "var-1", minGapDays: 4 * WEEK },
    { code: "dtap-4", vaccine: "dtap", dose: 4, from: 72, to: 78, after: "hexa-3", minGapDays: 182, note: { en: "DTaP-polio booster at 6 years.", es: "Refuerzo DTPa-polio a los 6 años." } },
  ],
  notes: [
    {
      en: "The public calendar differs between Spanish regions. This list follows the AEP's recommendations, so some doses are marked as optional where a region may not fund them.",
      es: "El calendario financiado varía entre comunidades autónomas. Esta lista sigue las recomendaciones de la AEP, por eso algunas dosis aparecen como opcionales cuando una comunidad puede no financiarlas.",
    },
    { en: "Doses at 6 years are shown for completeness.", es: "Las dosis de los 6 años se muestran para tener la serie completa." },
  ],
};

export const SCHEDULES: Record<VaccineScheduleId, ScheduleDef> = { us: US_SCHEDULE, es: ES_SCHEDULE };
