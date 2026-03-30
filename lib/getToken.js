import axios from "axios";

// -------- HUAWEI ENV --------
const huaweiBaseURL = process.env.HUAWEI_BASE;
const huaweiUserName = process.env.HUAWEI_USER;
const huaweiPassword = process.env.HUAWEI_PASS;

// -------- RUIJIE ENV --------
// Note: RUIJIE_BASE contains the token param, we need to handle it differently
const ruijieTokenURL = process.env.RUIJIE_BASE;

// Ruijie Account 1 (default for backward compatibility)
const ruijieAppId1 = process.env.RUIJIE_APP_ID_1 || process.env.RUIJIE_APP_ID;
const ruijieSecret1 = process.env.RUIJIE_SECRET_1 || process.env.RUIJIE_SECRET;

// Ruijie Account 2
const ruijieAppId2 = process.env.RUIJIE_APP_ID_2;
const ruijieSecret2 = process.env.RUIJIE_SECRET_2;

// -------- CACHES --------
let huaweiTokenCache = null;
let huaweiTokenExpiry = null;

// Separate caches for each Ruijie account
let ruijieTokenCache1 = null;
let ruijieTokenExpiry1 = null;

let ruijieTokenCache2 = null;
let ruijieTokenExpiry2 = null;

/* ---------------------------------------------------
   🔹 Huawei Token Handler (unchanged)
---------------------------------------------------- */
export async function getHuaweiToken() {
  const now = new Date();

  if (huaweiTokenCache && huaweiTokenExpiry && now < huaweiTokenExpiry) {
    return huaweiTokenCache;
  }

  const res = await axios.post(
    `${huaweiBaseURL}/v2/tokens`,
    {
      userName: huaweiUserName,
      password: huaweiPassword,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  huaweiTokenCache = res.data.data.token_id;
  huaweiTokenExpiry = new Date(res.data.data.expiredDate);

  return huaweiTokenCache;
}

/* ---------------------------------------------------
   🔹 Ruijie Token Handler - FIXED for separate accounts
---------------------------------------------------- */
export async function getRuijieToken(accountNumber = 1) {
  const now = new Date();
  
  // Determine which account to use
  let targetCache, targetExpiry, appId, secret;
  
  if (accountNumber === 1) {
    targetCache = ruijieTokenCache1;
    targetExpiry = ruijieTokenExpiry1;
    appId = ruijieAppId1;
    secret = ruijieSecret1;
  } else if (accountNumber === 2) {
    targetCache = ruijieTokenCache2;
    targetExpiry = ruijieTokenExpiry2;
    appId = ruijieAppId2;
    secret = ruijieSecret2;
  } else {
    throw new Error(`Invalid Ruijie account number: ${accountNumber}. Use 1 or 2.`);
  }

  // Check if credentials exist for this account
  if (!appId || !secret) {
    throw new Error(`Ruijie account ${accountNumber} credentials not configured`);
  }

  // Check cache first
  if (targetCache && targetExpiry && now < targetExpiry) {
    return targetCache;
  }

  // Parse the token URL to ensure we're using the correct endpoint
  // Your RUIJIE_BASE includes token param, but we need to use it as-is
  const tokenUrl = ruijieTokenURL;
  
  // Make API request with correct credentials for this account
  const res = await axios.post(
    tokenUrl,
    {
      appid: appId,
      secret: secret,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  const { code, accessToken, expired } = res.data;

  if (code !== 0 || !accessToken) {
    throw new Error(`Failed to get Ruijie token for account ${accountNumber}: ` + (res.data.msg || 'Unknown error'));
  }

  // Update the correct cache based on account number
  if (accountNumber === 1) {
    ruijieTokenCache1 = accessToken;
    ruijieTokenExpiry1 = new Date(Date.now() + expired * 1000);
    console.log(`Ruijie Account 1 token cached, expires in ${expired}s`);
  } else {
    ruijieTokenCache2 = accessToken;
    ruijieTokenExpiry2 = new Date(Date.now() + expired * 1000);
    console.log(`Ruijie Account 2 token cached, expires in ${expired}s`);
  }

  return accessToken;
}

/* ---------------------------------------------------
   🔹 NEW: Get all Ruijie tokens at once
---------------------------------------------------- */
export async function getAllRuijieTokens() {
  try {
    const tokens = {};
    
    // Get token for account 1
    try {
      tokens.ruijie1 = await getRuijieToken(1);
    } catch (error) {
      console.error('Error getting Ruijie token for account 1:', error.message);
      tokens.ruijie1 = null;
    }
    
    // Get token for account 2 (if configured)
    if (ruijieAppId2 && ruijieSecret2) {
      try {
        tokens.ruijie2 = await getRuijieToken(2);
      } catch (error) {
        console.error('Error getting Ruijie token for account 2:', error.message);
        tokens.ruijie2 = null;
      }
    } else {
      tokens.ruijie2 = null;
    }
    
    return tokens;
  } catch (error) {
    console.error('Error getting all Ruijie tokens:', error);
    throw error;
  }
}

/* ---------------------------------------------------
   🔹 NEW: Get Ruijie token for a specific vendor name
---------------------------------------------------- */
export async function getRuijieTokenForVendor(vendorName) {
  // Default to account 1 for backward compatibility
  if (!vendorName) {
    return getRuijieToken(1);
  }
  
  const vendorLower = vendorName.toLowerCase();
  
  if (vendorLower.includes('ruijie 2') || vendorLower.includes('ruijie2')) {
    return getRuijieToken(2);
  } else if (vendorLower.includes('ruijie 1') || vendorLower.includes('ruijie1')) {
    return getRuijieToken(1);
  } else if (vendorLower.includes('ruijie')) {
    // If just "Ruijie", default to account 1 for backward compatibility
    return getRuijieToken(1);
  }
  
  throw new Error(`Unknown Ruijie vendor: ${vendorName}`);
}

/* ---------------------------------------------------
   🔹 Debug function to check token status
---------------------------------------------------- */
export function checkTokenStatus() {
  const now = new Date();
  
  const status = {
    huawei: {
      hasToken: !!huaweiTokenCache,
      isExpired: huaweiTokenExpiry ? now >= huaweiTokenExpiry : true,
      expiresAt: huaweiTokenExpiry
    },
    ruijie1: {
      hasToken: !!ruijieTokenCache1,
      isExpired: ruijieTokenExpiry1 ? now >= ruijieTokenExpiry1 : true,
      expiresAt: ruijieTokenExpiry1
    },
    ruijie2: {
      hasToken: !!ruijieTokenCache2,
      isExpired: ruijieTokenExpiry2 ? now >= ruijieTokenExpiry2 : true,
      expiresAt: ruijieTokenExpiry2
    }
  };
  
  console.log('Token Status:', status);
  return status;
}

/* ---------------------------------------------------
   🔹 Clear token caches
---------------------------------------------------- */
export function clearTokenCaches() {
  huaweiTokenCache = null;
  huaweiTokenExpiry = null;
  ruijieTokenCache1 = null;
  ruijieTokenExpiry1 = null;
  ruijieTokenCache2 = null;
  ruijieTokenExpiry2 = null;
  console.log('All token caches cleared');
}