import { NextResponse } from 'next/server';
import { getConfiguredProviders, getEnv } from '@/server/env';

export async function GET() {
  try {
    const env = getEnv();
    const providers = getConfiguredProviders(env);

    return NextResponse.json(
      {
        status: 'ok',
        providers,
        vendorSource: env.VENDOR_SOURCE,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown configuration error';
    return NextResponse.json(
      {
        status: 'error',
        error: message,
      },
      { status: 500 }
    );
  }
}
