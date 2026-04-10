import mysql from 'mysql2/promise';

async function populateRuijie1Data() {
    const connection = await mysql.createConnection({
        host: '193.203.166.181',
        user: 'u159672040_dict',
        password: 'Freqit@098765', // Add your password here
        database: 'u159672040_dict'
    });

    try {
        // 1. Fetch only Ruijie 1 sites
        const [sites] = await connection.execute(
            'SELECT name FROM pics_sites WHERE vendor = ?', 
            ['Ruijie 1']
        );

        if (sites.length === 0) {
            console.log("No Ruijie 1 sites found.");
            return;
        }

        const startDate = new Date('2025-11-01');
        const endDate = new Date('2025-11-30');
        const insertData = [];

        for (const site of sites) {
            let currentDate = new Date(startDate);
            
            // Randomly designate some sites as "heavy" (100GB+)
            const isHeavySite = Math.random() > 0.7; 

            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0];

                // Generate User Row
                const totalUsers = isHeavySite ? 
                    Math.floor(Math.random() * 200) + 150 : 
                    Math.floor(Math.random() * 80) + 20;
                const activeUsers = Math.floor(totalUsers * (0.6 + Math.random() * 0.3));

                insertData.push([
                    site.name, dateStr, 'users', totalUsers, activeUsers, 0, 0, '', 'script_gen'
                ]);

                // Generate Traffic Row
                let downloadBytes;
                if (isHeavySite) {
                    // 100GB to 160GB range
                    downloadBytes = Math.floor(Math.random() * (160 - 100 + 1) + 100) * 1024 * 1024 * 1024;
                } else {
                    // 5GB to 50GB range
                    downloadBytes = Math.floor(Math.random() * (50 - 5 + 1) + 5) * 1024 * 1024 * 1024;
                }
                const uploadBytes = Math.floor(downloadBytes * (0.1 + Math.random() * 0.1));

                insertData.push([
                    site.name, dateStr, 'traffic', 0, 0, downloadBytes, uploadBytes, '', 'script_gen'
                ]);

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        // 2. Use INSERT IGNORE to skip existing records instead of crashing
        const query = `
            INSERT IGNORE INTO manual_data_pics 
            (site_id, date, data_type, total_users, active_users, download_bytes, upload_bytes, notes, created_by) 
            VALUES ?
        `;

        const [result] = await connection.query(query, [insertData]);
        console.log(`Operation complete.`);
        console.log(`Affected rows: ${result.affectedRows} (New records added)`);
        console.log(`Warning count: ${result.warningStatus} (Duplicates skipped)`);

    } catch (error) {
        console.error('Database Error:', error);
    } finally {
        await connection.end();
    }
}

populateRuijie1Data();