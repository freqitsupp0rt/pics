import { NextResponse } from "next/server";
import axios from "axios";
import { getHuaweiToken } from "@/lib/getToken";

/* ------------------ Helpers ------------------ */

function formatTimestampToYYYYMMDD(timestamp) {
  const date = new Date(timestamp * 1000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getAutoTimeDimension(beginTime, endTime) {
  const days = Math.ceil((endTime - beginTime) / 86400);

  if (days <= 30) return "day";
  if (days <= 90) return "week";
  if (days <= 365) return "month";
  return "year";
}

/* ------------------ Huawei Site Users ------------------ */

async function fetchSiteUsers(siteId, beginTime, endTime, timeDimension, deviceType, token) {
  const url = `https://naas-intl.huaweicloud.com:18002/controller/campus/v1/performanceservice/basicperformance/station/sites/${siteId}`;

  const response = await axios.get(url, {
    params: {
      beginTime: String(beginTime),
      endTime: String(endTime),
      timeDimension,
      deviceType,
    },
    headers: {
      "X-ACCESS-TOKEN": token,
      Accept: "application/json",
    },
  });

  if (response.data.errcode !== "0") {
    throw new Error(response.data.errmsg || "Huawei API error");
  }

  return response.data.data || [];
}

/* ------------------ POST ------------------ */

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      siteId,
      beginTime,
      endTime,
      timeDimension,
      deviceType = "AP",
    } = body;

    if (!siteId || !beginTime || !endTime) {
      return NextResponse.json(
        { errcode: "400", errmsg: "siteId, beginTime, and endTime are required" },
        { status: 400 }
      );
    }

    const begin = Number(beginTime);
    const end = Number(endTime);

    if (isNaN(begin) || isNaN(end)) {
      return NextResponse.json(
        { errcode: "400", errmsg: "beginTime and endTime must be Unix timestamps" },
        { status: 400 }
      );
    }

    const finalTimeDimension =
      timeDimension || getAutoTimeDimension(begin, end);

    const token = await getHuaweiToken();

    const rawData = await fetchSiteUsers(
      siteId,
      begin,
      end,
      finalTimeDimension,
      deviceType,
      token
    );

    const chartData = rawData.map(item => ({
      timeString: formatTimestampToYYYYMMDD(item.timestamp),
      timestamp: item.timestamp,
      siteId,
      user24G: item.user24G || 0,
      user5G: item.user5G || 0,
      total: (item.user24G || 0) + (item.user5G || 0),
    }));

    return NextResponse.json({
      errcode: "0",
      errmsg: "",
      data: chartData,
      meta: {
        siteId,
        deviceType,
        timeDimension: finalTimeDimension,
        totalRecords: rawData.length,
        dateRange: {
          start: formatTimestampToYYYYMMDD(begin),
          end: formatTimestampToYYYYMMDD(end),
        },
      },
    });
  } catch (error) {
    console.error("Huawei users report error:", error.message);

    return NextResponse.json(
      {
        errcode: "500",
        errmsg: error.message || "Failed to fetch Huawei user statistics",
      },
      { status: 500 }
    );
  }
}

/* ------------------ GET ------------------ */

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  return POST({
    json: async () => ({
      siteId: searchParams.get("siteId"),
      beginTime: searchParams.get("beginTime"),
      endTime: searchParams.get("endTime"),
      timeDimension: searchParams.get("timeDimension"),
      deviceType: searchParams.get("deviceType") || "AP",
    }),
  });
}
