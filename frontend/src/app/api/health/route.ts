import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    app: 'NEXORA Frontend',
    timestamp: new Date().toISOString(),
  });
}
