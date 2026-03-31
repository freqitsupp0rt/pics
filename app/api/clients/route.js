import { NextResponse } from "next/server";
import { getHuaweiToken, getAllRuijieTokens } from "@/lib/getToken";
import axios from "axios";

// Helper function to extract account number from vendor name
function extractRuijieAccountNumber(vendor) {
  if (!vendor) return 1;
  const vendorLower = vendor.toLowerCase();
  if (vendorLower.includes('ruijie 2') || vendorLower.includes('ruijie2')) return 2;
  if (vendorLower.includes('ruijie 1') || vendorLower.includes('ruijie1')) return 1;
  if (vendorLower.includes('ruijie')) {
    const match = vendor.match(/Ruijie\s*(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  }
  return 1;
}

// Reusable pagination function for Huawei
async function fetchHuaweiPaginatedData(url, token, pageSize = 100) {
  let allData = [];
  let pageIndex = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.get(`${url}?pageIndex=${pageIndex}&pageSize=${pageSize}`, {
      headers: { "X-AUTH-TOKEN": token },
      timeout: 10000
    });

    const data = response.data?.data || [];
    allData = allData.concat(data);

    hasMore = data.length === pageSize;
    pageIndex++;
  }

  return allData;
}

// Helper function to fetch Ruijie users
async function fetchRuijieUsers(token, accountNumber = 1) {
  try {
    console.log(`Fetching users from Ruijie Account ${accountNumber}...`);
    
    const ruijieRes = await axios.post(
      `https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/sta/sta_users?access_token=${token}`,
      {
        staType: "currentUser",
        pageIndex: "1",
        pageSize: "1000"
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
    
    console.log(`Ruijie Account ${accountNumber} Response Status:`, ruijieRes.status);
    
    const users = ruijieRes.data.list ?? [];
    console.log(`Ruijie Account ${accountNumber} Users Count:`, users.length);
    
    // Tag users with account number
    return users.map(user => ({ 
      ...user, 
      vendor: `Ruijie ${accountNumber}`
    }));
    
  } catch (error) {
    console.error(`Ruijie Account ${accountNumber} API Error:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error(`Failed to fetch Ruijie Account ${accountNumber} users: ${error.message}`);
  }
}

export async function GET() {
  try {
    console.log('Fetching clients from all vendors...');
    
    // Get Ruijie tokens first
    const ruijieTokens = await getAllRuijieTokens();
    console.log('Ruijie tokens status:', {
      account1: !!ruijieTokens.ruijie1,
      account2: !!ruijieTokens.ruijie2
    });
    
    // Fetch from all vendors
    const results = await Promise.allSettled([
      // Huawei
      (async () => {
        try {
          const token = await getHuaweiToken();
          console.log("Huawei Token:", token ? "Received" : "Missing");
          
          if (!token) return [];
          
          // Use pagination to get ALL Huawei users
          const users = await fetchHuaweiPaginatedData(
            `${process.env.HUAWEI_BASE}/campus/v1/accountservice/onlineusers`,
            token,
            100 // pageSize
          );
          
          console.log("Huawei Users Count:", users.length);
          return users.map(user => ({ 
            ...user, 
            vendor: "Huawei"
          }));
        } catch (error) {
          console.error("Huawei API Error:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
          return [];
        }
      })(),
      
      // Ruijie Account 1
      (async () => {
        if (!ruijieTokens.ruijie1) {
          console.log('Ruijie Account 1: No token available');
          return [];
        }
        try {
          return await fetchRuijieUsers(ruijieTokens.ruijie1, 1);
        } catch (error) {
          console.error('Ruijie Account 1 fetch error:', error.message);
          return [];
        }
      })(),
      
      // Ruijie Account 2
      (async () => {
        if (!ruijieTokens.ruijie2) {
          console.log('Ruijie Account 2: No token available');
          return [];
        }
        try {
          return await fetchRuijieUsers(ruijieTokens.ruijie2, 2);
        } catch (error) {
          console.error('Ruijie Account 2 fetch error:', error.message);
          return [];
        }
      })()
    ]);

    // Process results
    const allUsers = [];
    const vendorStats = {};
    const vendorErrors = {};
    
    // Huawei
    if (results[0].status === 'fulfilled') {
      allUsers.push(...results[0].value);
      vendorStats.huawei = results[0].value.length;
    } else {
      vendorStats.huawei = 0;
      vendorErrors.huawei = results[0].reason?.message || 'Unknown error';
    }
    
    // Ruijie 1
    if (results[1].status === 'fulfilled') {
      allUsers.push(...results[1].value);
      vendorStats.ruijie1 = results[1].value.length;
    } else {
      vendorStats.ruijie1 = 0;
      vendorErrors.ruijie1 = results[1].reason?.message || 'Unknown error';
    }
    
    // Ruijie 2
    if (results[2].status === 'fulfilled') {
      allUsers.push(...results[2].value);
      vendorStats.ruijie2 = results[2].value.length;
    } else {
      vendorStats.ruijie2 = 0;
      vendorErrors.ruijie2 = results[2].reason?.message || 'Unknown error';
    }

    console.log("Client fetching complete:", vendorStats);

    return NextResponse.json({
      success: true,
      totalRecords: allUsers.length,
      data: allUsers,
      vendorStats,
      vendorErrors: Object.keys(vendorErrors).length > 0 ? vendorErrors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Overall API error:", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data
    });
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch online users", 
        details: err.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also support POST method for filtering by vendor
export async function POST(request) {
  try {
    const body = await request.json();
    const { vendor } = body;
    
    // If a specific vendor is requested, only fetch from that vendor
    if (vendor) {
      let users = [];
      const vendorLower = vendor.toLowerCase();
      
      if (vendorLower.includes('huawei')) {
        try {
          const token = await getHuaweiToken();
          const data = await fetchHuaweiPaginatedData(
            `${process.env.HUAWEI_BASE}/campus/v1/accountservice/onlineusers`,
            token,
            100
          );
          users = data.map(user => ({ ...user, vendor: "Huawei" }));
        } catch (error) {
          console.error("Huawei API Error:", error.message);
          throw error;
        }
      } else if (vendorLower.includes('ruijie')) {
        const accountNumber = extractRuijieAccountNumber(vendor);
        const ruijieTokens = await getAllRuijieTokens();
        const tokenKey = accountNumber === 2 ? 'ruijie2' : 'ruijie1';
        const token = ruijieTokens[tokenKey];
        
        if (!token) {
          throw new Error(`No token available for ${vendor}`);
        }
        
        users = await fetchRuijieUsers(token, accountNumber);
      } else {
        return NextResponse.json(
          { 
            success: false,
            error: "Unsupported vendor. Use 'huawei', 'ruijie', 'ruijie 1', or 'ruijie 2'" 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        totalRecords: users.length,
        data: users,
        vendor,
        timestamp: new Date().toISOString(),
      });
    }
    
    // If no vendor specified, return all users (same as GET)
    return await GET();
    
  } catch (error) {
    console.error("POST API error:", error.message);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch users",
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}