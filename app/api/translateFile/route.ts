import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { processPDFDocument } from '@/lib/translation';
import { VALID_LANGUAGE_KEYS, MAX_FILE_SIZE_BYTES } from '@/lib/languages';

// Force Node.js runtime so we have access to fs, Buffer, etc.
// Without this, Next.js may use the Edge runtime which doesn't support file I/O.
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // ---------------------------------------------------------------
    // 1. Parse the multipart form — this is what actually receives the
    //    PDF binary. The bug you hit was likely caused by the route file
    //    not being at app/api/translateFile/route.ts, which caused Next
    //    to fall through to a page handler that expected JSON.
    // ---------------------------------------------------------------
    const formData = await request.formData();
    const file = formData.get('file');
    const language = formData.get('language');

    // ---------------------------------------------------------------
    // 2. Validate inputs
    // ---------------------------------------------------------------
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file provided. Upload a PDF using the "file" field.' },
        { status: 400 }
      );
    }

    if (typeof language !== 'string' || !VALID_LANGUAGE_KEYS.has(language.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: `Invalid language. Supported: ${[...VALID_LANGUAGE_KEYS].join(', ')}` },
        { status: 400 }
      );
    }

    // File type — check both extension and MIME
    const isPDF =
      file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    if (!isPDF) {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are supported.' },
        { status: 400 }
      );
    }

    // File size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File exceeds the maximum size of 10 MB (received ${(file.size / 1024 / 1024).toFixed(2)} MB).` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'The uploaded file is empty.' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // 3. Write to a temp file with a UUID name (collision-safe)
    // ---------------------------------------------------------------
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    tempFilePath = join(tmpdir(), `${randomUUID()}-${safeName}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempFilePath, buffer);

    console.log('[route] Saved temp file:', tempFilePath, `(${file.size} bytes)`);

    // ---------------------------------------------------------------
    // 4. Process: extract → summarise → translate
    // ---------------------------------------------------------------
    const result = await processPDFDocument(tempFilePath, language.toLowerCase());

    // ---------------------------------------------------------------
    // 5. Clean up temp file (success path)
    // ---------------------------------------------------------------
    await unlink(tempFilePath);
    tempFilePath = null; // signal to the catch block that cleanup is done
    console.log('[route] Temp file cleaned up');

    // ---------------------------------------------------------------
    // 6. Return result
    // ---------------------------------------------------------------
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result); // already shaped correctly in translation.ts

  } catch (error: any) {
    console.error('[route] Unhandled error:', error);

    // Clean up temp file if it still exists
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch {
        // best-effort; don't mask the original error
      }
    }

    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}