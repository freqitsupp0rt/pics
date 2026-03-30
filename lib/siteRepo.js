import { pool } from './db.js';

// Insert or update multiple sites (UPSERT)
export async function upsertSites(sites) {
  if (!sites.length) return;

  const sql = `
    INSERT INTO pics_sites
      (vendor, vendor_site_id, name, description, latitude, longitude, raw, last_synced_at)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      description = VALUES(description),
      latitude = VALUES(latitude),
      longitude = VALUES(longitude),
      raw = VALUES(raw),
      last_synced_at = VALUES(last_synced_at)
  `;

  const values = sites.map(s => [
    s.vendor,
    s.vendor_site_id,
    s.name,
    s.description || '',
    s.latitude || 0,
    s.longitude || 0,
    JSON.stringify(s.raw || {}),
    new Date(),
  ]);

  await pool.query(sql, [values]);
}
