const https = require('https');

const API_KEY = process.env.BIND_API_KEY;
const API_URL = 'https://api.bind.com.mx';

function fetchPage(skip, top) {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/Orders?$top=${top}&$skip=${skip}`;
    const req = https.get(url, { headers: { 'Authorization': `Bearer ${API_KEY}` } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

async function main() {
  const clients = {};
  let skip = 0;
  const pageSize = 100;
  let totalFetched = 0;

  while (true) {
    const response = await fetchPage(skip, pageSize);
    const orders = response.value || [];

    for (const o of orders) {
      const cid = o.ClientID;
      if (!clients[cid]) {
        clients[cid] = { name: o.ClientName, count: 0, total: 0, lastDate: '' };
      }
      clients[cid].count++;
      clients[cid].total += (o.Total || 0);
      if (o.OrderDate > clients[cid].lastDate) {
        clients[cid].lastDate = o.OrderDate;
      }
    }

    totalFetched += orders.length;
    console.error(`Page ${Math.floor(skip/pageSize)+1}: ${orders.length} orders (total: ${totalFetched})`);

    if (orders.length < pageSize) break;
    skip += pageSize;
    await new Promise(r => setTimeout(r, 300));
  }

  // Output SQL update statements
  const entries = Object.entries(clients).sort((a,b) => b[1].count - a[1].count);

  console.log('-- Total orders fetched:', totalFetched);
  console.log('-- Total unique clients:', entries.length);

  for (const [cid, info] of entries) {
    const name = info.name.replace(/'/g, "''");
    const lastDate = info.lastDate ? `'${info.lastDate}'` : 'NULL';
    console.log(`UPDATE clients SET total_orders = ${info.count}, total_amount = ${info.total.toFixed(2)}, last_order_at = ${lastDate}, bind_id = '${cid}' WHERE UPPER(name) = UPPER('${name}');`);
  }
}

main().catch(console.error);
