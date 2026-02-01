import { NextRequest, NextResponse } from 'next/server';
import { processPDFDocument } from '@/lib/translation';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Disable default body parser for file uploads
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const language = formData.get('language') as string;

    console.log('Received request:', { 
      fileName: file?.name, 
      fileSize: file?.size,
      language 
    });

    // Validation
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!language || !['spanish', 'french', 'mandarin'].includes(language.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'Invalid language. Must be spanish, french, or mandarin' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Save uploaded file to temp directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Use OS temp directory
    const tempDir = tmpdir();
    tempFilePath = join(tempDir, `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
    
    console.log('Saving file to:', tempFilePath);
    await writeFile(tempFilePath, buffer);

    // Process the PDF
    console.log('Processing PDF...');
    const result = await processPDFDocument(tempFilePath, language.toLowerCase());

    // Clean up temp file
    try {
      await unlink(tempFilePath);
      console.log('Temp file cleaned up');
    } catch (cleanupError) {
      console.error('Error cleaning up temp file:', cleanupError);
    }

    // Check if processing was successful
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Processing failed' },
        { status: 500 }
      );
    }

    // Return successful result
    return NextResponse.json({
      success: true,
      translatedSummary: result.translatedSummary,
      actionPlan: result.actionPlan,
      targetLanguage: result.targetLanguage,
      summaryLength: result.summaryLength,
      originalLength: result.originalLength,
      timestamp: result.timestamp
    });
    
  } catch (error: any) {
    console.error('API Route Error:', error);
    
    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file after error:', cleanupError);
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An unexpected error occurred while processing your document' 
      },
      { status: 500 }
    );
  }
}