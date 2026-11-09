export function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'] || req.query.adminKey;
  if (!key || key !== process.env.ADMIN_KEY) {
    res.status(401).json({ status: false, code: 'UNAUTHORIZED', message: 'Invalid admin key' });
    return false;
  }
  return true;
}
