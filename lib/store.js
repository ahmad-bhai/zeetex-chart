// Vercel pe filesystem read-only hoti hai (except /tmp), 
// isliye hum read ke liye bundled JSON use karenge.
// Admin panel likhne ke liye Upstash Redis ya Vercel KV recommend karta hoon (baad me add karenge).

import fs from 'fs';
import path from 'path';

const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');

export function loadDB() {
  try {
    const raw = fs.readFileSync(USERS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: {}, pairs: {} };
  }
}

export function getUser(userId) {
  const db = loadDB();
  return db.users?.[String(userId)] || null;
}

export function getPair(pairName) {
  const db = loadDB();
  return db.pairs?.[pairName] || null;
}
