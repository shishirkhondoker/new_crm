import { NextResponse, type NextRequest } from "next/server";
import { proxy } from "@/proxy";

export function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    "/dashboard",
    "/admin/:path*",
    "/supervisor/:path*",
    "/marketer/:path*",
    "/leads/:path*",
    "/customers/:path*",
    "/products/:path*",
    "/quotations/:path*",
  ],
};

