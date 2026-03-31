import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // --- Public API routes (not protected)
  const publicRoutes = [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/auth/refresh",
    "/api/auth/extend-session", // Add this to public routes
  ];

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // --- Protect all /api/* routes
  if (pathname.startsWith("/api")) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    try {
      const decoded = verifyToken(token);

      // Inject user into headers for API consumption
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user", JSON.stringify(decoded));

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

    } catch (err) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired token" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};