import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const [g, m] = await Promise.all([
        db.ref('config/mode').once('value'), 
        db.ref('modes').once('value')
      ]); 
      return res.status(200).json({ 
        status: true, 
        global: g.val() || 'manual', 
        pairs: m.val() || {} 
      });
    }

    if (req.method === 'POST') {
      const { pair, mode } = req.body || {};
      if (!['auto', 'manual'].includes(mode)) {
        return res.status(400).json({ status: false, message: 'mode must be auto|manual' });
      }

      if (pair) {
        await db.ref(`modes/${pair}`).set(mode);
      } else {
        await db.ref('config/mode').set(mode);
        await db.ref('modes').remove();
      }

      const logId = Date.now();
      await db.ref(`logs/${logId}_mode`).set({
        ts: logId,
        type: 'mode',
        pair: pair || 'ALL',
        mode,
        by: req.headers['x-employee'] || 'admin'
      });

      return res.status(200).json({ status: true, pair: pair || 'ALL', mode });
    }

    return res.status(405).json({ status: false, message: 'Method not allowed' });
  } catch (e) {
    console.error('[MODE_API_ERROR]', e);
    return res.status(500).json({ status: false, message: e.message });
  }
}
