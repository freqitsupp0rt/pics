import { NextResponse } from 'next/server';
import axios from 'axios';
import { getHuaweiToken, getRuijieToken } from "@/lib/getToken";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const vendor = searchParams.get('vendor');

  console.log('API Route Hit - App Router:', { siteId, vendor });

  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor is required' }, { status: 400 });
  }

  try {
    let devices = [];

    if (vendor.toLowerCase().includes('huawei')) {
      devices = await fetchHuaweiDevices(siteId);
    } else if (vendor.toLowerCase().includes('ruijie')) {
      // Determine which Ruijie account to use based on vendor name
      const accountNumber = extractRuijieAccountNumber(vendor);
      devices = await fetchRuijieDevices(siteId, accountNumber);
    } else {
      return NextResponse.json({ 
        error: 'Unsupported vendor. Use "huawei", "ruijie", "ruijie 1", or "ruijie 2"' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: devices,
      total: devices.length,
      vendor: vendor.toLowerCase()
    });

  } catch (error) {
    console.error(`Devices API error for ${vendor} site ${siteId}:`, error.message);
    return NextResponse.json({ 
      success: false,
      error: "Failed to fetch devices",
      details: error.message
    }, { status: 500 });
  }
}

// Helper function to extract account number from vendor name
function extractRuijieAccountNumber(vendor) {
  const vendorLower = vendor.toLowerCase();
  
  if (vendorLower.includes('ruijie 2') || vendorLower.includes('ruijie2')) {
    return 2;
  } else if (vendorLower.includes('ruijie 1') || vendorLower.includes('ruijie1')) {
    return 1;
  } else if (vendorLower.includes('ruijie')) {
    // Try to extract account number from vendor string
    const match = vendor.match(/Ruijie\s*(\d+)/i);
    return match ? parseInt(match[1]) : 1; // Default to account 1 for backward compatibility
  }
  
  return 1; // Default to account 1
}

// Huawei Devices Fetch
async function fetchHuaweiDevices(siteId) {
  try {
    const token = await getHuaweiToken();
    const baseURL = process.env.HUAWEI_BASE;

    const response = await axios.get(`${baseURL}/campus/v3/devices`, {
      params: { siteId },
      headers: { "X-AUTH-TOKEN": token },
      timeout: 15000
    });

    // Normalize Huawei device data
    return (response.data.data || []).map(device => ({
      id: device.id || device.deviceId || `huawei-${Date.now()}-${Math.random()}`,
      name: device.name || device.deviceName || 'Unnamed Device',
      type: device.deviceType || 'Unknown',
      model: device.deviceModel || 'Unknown',
      serialNumber: device.esn || 'N/A',
      macAddress: device.mac || 'N/A',
      ipAddress: device.ip || 'N/A',
      status: getHuaweiStatus(device.status),
      siteId: device.siteId || siteId,
      vendor: 'Huawei',
      firmware: device.softwareVersion || 'Unknown',
      uptime: device.uptime || 'N/A',
      lastSeen: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching Huawei devices:', error.message);
    throw new Error(`Failed to fetch Huawei devices: ${error.message}`);
  }
}

// Ruijie Devices Fetch
async function fetchRuijieDevices(groupId, accountNumber = 1) {
  try {
    const token = await getRuijieToken(accountNumber);
    const page = 1;
    const perPage = 100;
    
    const productTypes = ["EAP", "EHR"];
    const results = [];

    console.log(`Fetching Ruijie Account ${accountNumber} devices for group ${groupId}`);

    for (const type of productTypes) {
      const apiUrl = `https://cloud-as.ruijienetworks.com/service/api/maint/devices?page=${page}&per_page=${perPage}&group_id=${groupId}&product_type=${type}&access_token=${token}`;
      
      try {
        const response = await axios.get(apiUrl, { timeout: 15000 });
        const data = response.data;
        
        if (data.code !== 0 || !data.deviceList) {
          console.warn(`No devices found for ${type} (Account ${accountNumber}):`, data.msg || "Invalid device data");
          continue;
        }

        results.push(
          ...data.deviceList.map(device => ({
            id: device.serialNumber || `ruijie-${accountNumber}-${Date.now()}-${Math.random()}`,
            name: device.name || device.aliasName || 'Unnamed Device',
            type: device.productType || 'Unknown',
            model: device.productClass || 'Unknown',
            serialNumber: device.serialNumber || 'N/A',
            macAddress: formatMacAddress(device.mac),
            ipAddress: device.localIp || 'N/A',
            status: device.onlineStatus === 'ON' ? 'Online' : 'Offline',
            siteId: device.groupId || groupId,
            vendor: `Ruijie ${accountNumber}`,
            groupName: device.groupName,
            firmware: device.firmwareVersion || 'Unknown',
            uptime: device.upTime || 'N/A',
            lastSeen: device.lastOnlineTime || new Date().toISOString(),
          }))
        );
      } catch (typeError) {
        console.error(`Error fetching Ruijie ${type} devices for account ${accountNumber}:`, typeError.message);
        continue;
      }
    }

    console.log(`Found ${results.length} devices for Ruijie Account ${accountNumber}`);
    return results;
  } catch (error) {
    console.error(`Error fetching Ruijie devices for account ${accountNumber}:`, error.message);
    throw new Error(`Failed to fetch Ruijie Account ${accountNumber} devices: ${error.message}`);
  }
}

function formatMacAddress(mac) {
  if (!mac) return 'N/A';
  
  // Remove dots and convert to uppercase
  const cleanMac = mac.replace(/\./g, '').toUpperCase();
  
  // Split into pairs and join with hyphens
  const formattedMac = cleanMac.match(/.{1,2}/g)?.join('-');
  
  return formattedMac || mac;
}

function getHuaweiStatus(statusCode) {
  if (!statusCode) return 'Unknown';
  
  const code = parseInt(statusCode);
  
  if (code >= 0 && code <= 1) {
    return 'Online';
  } else if (code >= 3 && code <= 4) {
    return 'Offline';
  } else {
    return 'Unknown';
  }
}