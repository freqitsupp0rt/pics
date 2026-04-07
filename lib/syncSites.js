import axios from 'axios';
import { upsertSites } from './siteRepo.js';
import { getHuaweiToken, getAllRuijieTokens } from './getToken.js';

export async function fetchAndUpsertSites() {
  const sites = [];

  // --- Huawei ---
  const huaweiToken = await getHuaweiToken();
  if (huaweiToken) {
    const res = await axios.get(`${process.env.HUAWEI_BASE}/campus/v3/sites`, {
      headers: { "X-Auth-Token": huaweiToken },
      timeout: 15000
    });

    const huaweiSites = (res.data.data || []).map(site => ({
      vendor: 'Huawei',
      vendor_site_id: site.id,
      name: site.name,
      latitude: parseFloat(site.latitude || 0),
      longitude: parseFloat(site.longitude || 0),
      description: site.description || '',
      raw: site
    }));

    sites.push(...huaweiSites);
  }

  // --- Ruijie ---
  const ruijieTokens = await getAllRuijieTokens();
  for (const [accountName, token] of Object.entries(ruijieTokens)) {
    if (!token) continue;

    const res = await axios.get(
      `https://cloud-as.ruijienetworks.com/service/api/group/single/tree?access_token=${token}`,
      { timeout: 15000 }
    );

    const groups = res.data.groups;
    if (groups?.subGroups) {
      const freqitGroup = groups.subGroups.find(g => g.name === 'picsbiliran');
      if (freqitGroup?.subGroups) {
        const ruijieSites = freqitGroup.subGroups.map(site => ({
          vendor: `Ruijie ${accountName.replace('ruijie', '')}`,
          vendor_site_id: site.groupId.toString(),
          name: site.name,
          latitude: parseFloat(site.latitude || 0),
          longitude: parseFloat(site.longtitude || site.longitude || 0),
          description: site.description || '',
          raw: site
        }));

        sites.push(...ruijieSites);
      }
    }
  }

  console.log(`Fetched ${sites.length} sites from vendors`);

  // --- UPSERT to DB ---
  await upsertSites(sites);
  console.log('Sites successfully upserted to DB');

  return sites.length;
}
