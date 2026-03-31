import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

function generateTrafficData(vendor, previousData) {
    const lowerTrafficBound = 100 * 1024 * 1024; // 100MB
    const upperTrafficBound = 5 * 1024 * 1024 * 1024; // 5GB
    const randomTrafficIncrement = 1 * 1024 * 1024 * 1024; // 1GB
    const maxTrendChange = 500 * 1024 * 1024; // 500MB max change per day

    let baseTraffic;

    if (previousData && previousData.baseTraffic) {
        // Trend flow: adjust previous traffic by a random amount to create a trend
        const change = Math.floor(Math.random() * (maxTrendChange * 2 + 1)) - maxTrendChange;
        baseTraffic = previousData.baseTraffic + change;
        // Clamp within bounds
        baseTraffic = Math.max(lowerTrafficBound, Math.min(upperTrafficBound, baseTraffic));
    } else {
        // Initial random start
        baseTraffic = Math.floor(Math.random() * (upperTrafficBound - lowerTrafficBound)) + lowerTrafficBound;
    }

    let rxBytes = 0;
    let txBytes = 0;

    if (vendor === 'omada') {
        // Rule: omada tx should be larger than rx
        rxBytes = baseTraffic;
        // TX is larger (add min 10MB to ensure strict inequality)
        txBytes = baseTraffic + Math.floor(Math.random() * randomTrafficIncrement) + (10 * 1024 * 1024);
    } else if (vendor === 'ruijie') {
        // Rule: ruijie rx should be larger than tx
        txBytes = baseTraffic;
        // RX is larger (add min 10MB to ensure strict inequality)
        rxBytes = baseTraffic + Math.floor(Math.random() * randomTrafficIncrement) + (10 * 1024 * 1024);
    } else {
        // Fallback for other vendors
        rxBytes = Math.floor(Math.random() * upperTrafficBound);
        txBytes = Math.floor(Math.random() * upperTrafficBound);
    }

    return { rxBytes, txBytes, baseTraffic };
}

export async function POST(request) {
    let connection;
    try {
        const body = await request.json();
        const { siteId, dates, vendor, preview } = body;

        if (!siteId || !dates || !Array.isArray(dates) || dates.length === 0) {
            return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
        }

        connection = await pool.getConnection();
        const recordsToInsert = [];
        const siteTrafficState = new Map();
        const normalizedVendor = (vendor || '').toLowerCase();

        // Sort dates to ensure trend flow works chronologically
        const sortedDates = [...dates].sort();

        for (const dateStr of sortedDates) {
            // Parse date to determine if it's a weekend (assuming YYYYMMDD format)
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const dateObj = new Date(year, month, day);
            const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // --- Users Data Generation ---
            let totalUsers = 0;
            let activeUsers = 0;

            if (normalizedVendor === 'omada') {
                // Rule: omada user should be 100 below
                // Simulate lower usage on weekends
                const maxUsers = isWeekend ? 50 : 99;
                const minUsers = isWeekend ? 5 : 20;
                totalUsers = Math.floor(Math.random() * (maxUsers - minUsers + 1)) + minUsers;
                // Rule: omada total user and active user should be the same
                activeUsers = totalUsers;
            } else if (normalizedVendor === 'ruijie') {
                // Rule: ruijie user should be 150 maximum
                // Simulate lower usage on weekends
                const maxUsers = isWeekend ? 70 : 150;
                const minUsers = isWeekend ? 10 : 40;
                totalUsers = Math.floor(Math.random() * (maxUsers - minUsers + 1)) + minUsers;
                // Rule: ruijie total user should be larger than active user
                // Active users roughly 60-90% of total
                const activeRatio = 0.6 + (Math.random() * 0.3);
                activeUsers = Math.floor(totalUsers * activeRatio);
            } else {
                const maxUsers = isWeekend ? 20 : 50;
                totalUsers = Math.floor(Math.random() * maxUsers) + 1;
                activeUsers = Math.floor(Math.random() * totalUsers);
            }

            // --- Traffic Data Generation ---
            const previousData = siteTrafficState.get(siteId);
            const { rxBytes, txBytes, baseTraffic } = generateTrafficData(normalizedVendor, previousData);

            // Push 'users' record
            recordsToInsert.push([
                siteId,
                dateStr,
                'users',
                totalUsers,
                activeUsers,
                0,
                0,
                'Auto-generated users (Gap Fill)'
            ]);

            // Push 'traffic' record
            recordsToInsert.push([
                siteId,
                dateStr,
                'traffic',
                0,
                0,
                rxBytes,
                txBytes,
                'Auto-generated traffic (Gap Fill)'
            ]);

            // Update state for next day
            siteTrafficState.set(siteId, { baseTraffic });
        }

        if (preview) {
            const previewData = recordsToInsert.map(r => ({
                site_id: r[0],
                date: r[1], // YYYYMMDD
                data_type: r[2],
                total_users: r[3],
                active_users: r[4],
                download_bytes: r[5],
                upload_bytes: r[6],
                notes: r[7]
            }));
            return NextResponse.json({ success: true, data: previewData });
        }

        if (recordsToInsert.length > 0) {
            const query = `
                INSERT INTO manual_data_pics 
                (site_id, date, data_type, total_users, active_users, download_bytes, upload_bytes, notes) 
                VALUES ?
            `;
            await connection.query(query, [recordsToInsert]);
        }

        return NextResponse.json({ success: true, inserted: recordsToInsert.length });

    } catch (error) {
        console.error('Error populating data:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}