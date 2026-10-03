import type { APIRoute } from 'astro';
import sharp from 'sharp';
import image from '../assets/og-image.svg?raw';

export const GET: APIRoute = async () =>
    new Response(
        new Uint8Array(await sharp(Buffer.from(image)).png().toBuffer()),
        {
            headers: { 'Content-Type': 'image/png' },
        },
    );
