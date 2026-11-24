import type { PosKey } from './positions';

export interface Project {
  no: string;
  piece: string;
  trait: string;
  name: string;
  cat: string;
  img: { avif: string; webp: string; jpg: string };
  alt: string;
  link: string;
  problem: string;
  /** Rejected options and why: [what, why]. Mark fills these with his real decisions. */
  cands: [string, string][];
  choice: string;
  figs: [string, string][];
  stack: string;
}

/**
 * Source: the github.com/MarkCabalbag repos (README, description, homepage).
 * Images are left empty on purpose: Mark fills `img` and `alt` himself.
 * The chess position each project plays (knight, bishop, rook, queen) is set in positions.json.
 */
export const PROJ: Record<PosKey, Project> = {
  knight: {
    no: '01', piece: 'Knight', trait: 'Most inventive', name: 'Pestwatch', cat: 'IoT · Pest monitoring',
    img: { avif: '', webp: '', jpg: '' }, alt: '', link: 'https://markcabalbag.github.io/Pestwatch/',
    problem: 'Farms need to know when pests are near and what the temperature and humidity are, without someone checking in person.',
    cands: [['', ''], ['', '']],
    choice: 'An Arduino UNO R4 WiFi that reads temperature, humidity and nearby pests, alerts on site with an LCD, a buzzer and SMS, and posts every reading to a PHP server for a real-time web dashboard.',
    figs: [['2', 'sensors'], ['3', 'on-site alerts']], stack: 'Arduino UNO R4 WiFi, DHT22, IR sensor, SIM800L · PHP, JavaScript dashboard',
  },
  bishop: {
    no: '02', piece: 'Bishop', trait: 'Cut through complexity', name: 'ISPSC Graduate Tracer', cat: 'Education · Survey and admin dashboard',
    img: { avif: '', webp: '', jpg: '' }, alt: '', link: 'https://ispsc-graduate-tracer.vercel.app',
    problem: 'The college needs graduates to report their employment, and the MIS office needs CHED-ready employability figures from those responses.',
    cands: [['', ''], ['', '']],
    choice: 'A graduate tracer survey with an admin dashboard that turns responses into employability figures by year and program, with Excel and CSV export.',
    figs: [['2', 'export formats'], ['1', 'response per email']], stack: 'React 19, TypeScript, Vite, Tailwind CSS 4 · Express, Prisma, PostgreSQL',
  },
  rook: {
    no: '03', piece: 'Rook', trait: 'Solid foundations', name: 'Radio Frequency Identification', cat: 'IoT · School access control',
    img: { avif: '', webp: '', jpg: '' }, alt: '', link: 'https://markcabalbag.github.io/Radio-Frequency-Identification/',
    problem: 'Classrooms and sensitive areas should open only for authorized teachers, so students can’t use empty rooms as hangout spots.',
    cands: [['', ''], ['', '']],
    choice: 'RFID tags in teacher ID cards and ESP32 readers at the door, managed from a MERN dashboard that registers, updates and monitors cards and their online status.',
    figs: [['3', 'parts: web, API, Arduino'], ['6', 'hardware components']], stack: 'MongoDB, Express, React, Node.js · ESP32, RC522 RFID reader',
  },
  queen: {
    no: '04', piece: 'Queen', trait: 'Signature work', name: 'EduGemini', cat: 'Education · AI-assisted grading',
    img: { avif: '', webp: '', jpg: '' }, alt: '', link: 'https://edu-gemini-8jai.vercel.app/',
    problem: 'Teachers spend hours grading every submission against the same criteria.',
    cands: [['', ''], ['', '']],
    choice: 'Students submit work, Gemini drafts a score and feedback against the instructor’s criteria, and the instructor reviews and approves every final grade.',
    figs: [['3', 'apps: API, web, end-to-end tests'], ['2', 'shared packages']], stack: 'React 19, Vite, Tailwind CSS · Express 5, Prisma, Supabase · Google Gemini',
  },
};

export const EMAIL = 'cabalbagmarkjerielg@gmail.com';

/** HUD notation ticker tokens: [label, act, local progress at which it appears] */
export const TICK: [string, string, number][] = [
  ['1.e4', 'opening', 0.36], ['e5', 'opening', 0.45], ['2.d4', 'opening', 0.58], ['d5', 'opening', 0.67],
  ['P01', 'knight', 0.2], ['Nc7+', 'knight', 0.6], ['P02', 'bishop', 0.2], ['Bc4+', 'bishop', 0.6],
  ['P03', 'rook', 0.2], ['Re7', 'rook', 0.6], ['P04', 'queen', 0.2], ['Qh1', 'queen', 0.6], ['Kf8', 'queen', 0.7],
  ['M1', 'mate', 0.5],
];
