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

function convertBpsToReadable(bps, targetUnit = "auto") {
  const bytes = bps / 8;

  const units = [
    { unit: "GB/s", value: 1024 ** 3 },
    { unit: "MB/s", value: 1024 ** 2 },
    { unit: "KB/s", value: 1024 },
    { unit: "B/s", value: 1 },
  ];

  let selected = units[3];

  if (targetUnit === "auto") {
    selected = units.find(u => bytes >= u.value) || units[3];
  } else {
    selected = units.find(u => u.unit.toLowerCase() === targetUnit.toLowerCase()) || units[3];
  }

  return {
    value: parseFloat((bytes / selected.value).toFixed(2)),
    unit: selected.unit,
  };
}

function getAutoTimeDimension(beginTime, endTime) {
  const days = Math.ceil((endTime - beginTime) / 86400);

  if (days <= 30) return "day";
  if (days <= 90) return "week";
  if (days <= 365) return "month";
  return "year";
}

/* ------------------ Huawei Site Traffic ------------------ */

async function fetchSiteTraffic(siteId, beginTime, endTime, timeDimension, token) {
  const url =
    "https://naas-intl.huaweicloud.com:18002/controller/campus/v1/performanceservice/basicperformance/networktraffic";

  const response = await axios.get(url, {
    params: {
      mode: "site",
      id: siteId,
      timeDimension,
      beginTime: String(beginTime),
      endTime: String(endTime),
    },
    headers: {
      "X-ACCESS-TOKEN": token,
      Accept: "application/json",
    },
  });

  if (response.data.errcode !== "0") {
    throw new Error(response.data.errmsg || "Huawei API error");
  }

  return response.data;
}

/* ------------------ POST ------------------ */

export async function POST(request) {
  try {
    const body = await request.json();
    const { siteId, beginTime, endTime, timeDimension, unit = "auto" } = body;

    if (!siteId || !beginTime || !endTime) {
      return NextResponse.json(
        { errcode: "400", errmsg: "siteId, beginTime, and endTime are required" },
        { status: 400 }
      );
    }

    const begin = Number(beginTime);
    // Add 1 day (86400 seconds) to endTime to ensure the last day is included
    const end = Number(endTime) + 86400;

    if (isNaN(begin) || isNaN(end)) {
      return NextResponse.json(
        { errcode: "400", errmsg: "beginTime and endTime must be Unix timestamps" },
        { status: 400 }
      );
    }

    const finalTimeDimension =
      timeDimension || getAutoTimeDimension(begin, end);

    const token = await getHuaweiToken();
    const raw = await fetchSiteTraffic(
      siteId,
      begin,
      end,
      finalTimeDimension,
      token
    );

    const chartData = raw.data.map(item => {
      const up = convertBpsToReadable(item.uplinkRate, unit);
      const down = convertBpsToReadable(item.downlinkRate, unit);

      const finalUnit =
        unit === "auto"
          ? up.unit === "GB/s" || down.unit === "GB/s"
            ? "GB/s"
            : up.unit === "MB/s" || down.unit === "MB/s"
            ? "MB/s"
            : up.unit === "KB/s" || down.unit === "KB/s"
            ? "KB/s"
            : "B/s"
          : unit;

      return {
        timeString: formatTimestampToYYYYMMDD(item.timestamp),
        uplinkRate:
          finalUnit === up.unit
            ? up.value
            : convertBpsToReadable(item.uplinkRate, finalUnit).value,
        downlinkRate:
          finalUnit === down.unit
            ? down.value
            : convertBpsToReadable(item.downlinkRate, finalUnit).value,
        rxBytes: down.value,
        txBytes: up.value,
        unit: finalUnit,
      };
    });

    return NextResponse.json({
      errcode: "0",
      errmsg: "",
      data: chartData,
      meta: {
        siteId,
        timeDimension: finalTimeDimension,
        totalRecords: raw.totalRecords,
        dateRange: {
          start: formatTimestampToYYYYMMDD(begin),
          end: formatTimestampToYYYYMMDD(end),
        },
      },
    });
  } catch (error) {
    console.error("Huawei site traffic error:", error.message);

    return NextResponse.json(
      {
        errcode: "500",
        errmsg: error.message || "Failed to fetch Huawei site traffic",
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
      unit: searchParams.get("unit") || "auto",
    }),
  });
}
