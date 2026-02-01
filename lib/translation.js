const { TranslationServiceClient } = require('@google-cloud/translate').v3;
const fs = require('fs').promises;
const pdf = require('pdf-parse');

// Initialize translation client
const translationClient = new TranslationServiceClient();
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id';
const location = 'global';

// Language configurations
const SUPPORTED_LANGUAGES = {
  spanish: 'es',
  french: 'fr',
  mandarin: 'zh-CN'
};

async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function translateText(text, targetLanguage, sourceLanguage = 'en') {
  try {
    const maxChunkSize = 25000;
    if (text.length <= maxChunkSize) {
      const request = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [text],
        mimeType: 'text/plain',
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
      };

      const [response] = await translationClient.translateText(request);
      return response.translations[0].translatedText;
    }

    const chunks = chunkText(text, maxChunkSize);
    const translatedChunks = [];

    for (const chunk of chunks) {
      const request = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [chunk],
        mimeType: 'text/plain',
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
      };

      const [response] = await translationClient.translateText(request);
      translatedChunks.push(response.translations[0].translatedText);
    }

    return translatedChunks.join(' ');
  } catch (error) {
    throw new Error(`Translation failed: ${error.message}`);
  }
}

function chunkText(text, maxSize) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        chunks.push(sentence.substring(0, maxSize));
        currentChunk = sentence.substring(maxSize);
      }
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function summarizeText(text, maxLength = 1000) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
  
  let summary = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if ((summary + trimmedSentence).length > maxLength) {
      break;
    }
    summary += trimmedSentence + ' ';
  }

  if (summary.length < 100 && cleanText.length > 100) {
    summary = cleanText.substring(0, maxLength) + '...';
  }

  return summary.trim();
}

function extractKeyTerms(text) {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word));

  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function detectDocumentType(text) {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('agreement') || lowerText.includes('contract')) {
    return 'legal';
  } else if (lowerText.includes('report') || lowerText.includes('analysis')) {
    return 'report';
  } else if (lowerText.includes('invoice') || lowerText.includes('payment')) {
    return 'financial';
  } else if (lowerText.includes('proposal') || lowerText.includes('recommendation')) {
    return 'proposal';
  } else if (lowerText.includes('policy') || lowerText.includes('procedure')) {
    return 'policy';
  } else if (lowerText.includes('minutes') || lowerText.includes('meeting')) {
    return 'meeting';
  } else if (lowerText.includes('research') || lowerText.includes('study')) {
    return 'research';
  }
  
  return 'general';
}

async function generateActionPlan(summary, targetLanguage, fullText = '') {
  try {
    const docType = detectDocumentType(fullText || summary);
    const keyTerms = extractKeyTerms(summary);
    
    let actionPlan = [];
    
    switch (docType) {
      case 'legal':
        actionPlan = [
          {
            step: 'Review legal terms and obligations',
            description: `Carefully examine all contractual obligations, deadlines, and legal requirements mentioned in the document. Pay special attention to terms related to: ${keyTerms.slice(0, 3).join(', ')}.`,
            priority: 'high'
          },
          {
            step: 'Consult with legal counsel',
            description: 'Schedule a meeting with your legal team to discuss implications and ensure full understanding of all clauses before proceeding.',
            priority: 'high'
          },
          {
            step: 'Create compliance checklist',
            description: 'Develop a detailed checklist of all requirements and deadlines to ensure nothing is missed during implementation.',
            priority: 'medium'
          }
        ];
        break;
        
      case 'financial':
        actionPlan = [
          {
            step: 'Verify all financial figures',
            description: `Cross-check all amounts, calculations, and financial data for accuracy. Focus on items related to: ${keyTerms.slice(0, 3).join(', ')}.`,
            priority: 'high'
          },
          {
            step: 'Process payment or billing',
            description: 'Initiate necessary payment procedures or update accounting records according to the document details.',
            priority: 'high'
          },
          {
            step: 'Archive for record-keeping',
            description: 'File the document in your financial records system and set reminders for any recurring payments or reviews.',
            priority: 'medium'
          }
        ];
        break;
        
      case 'report':
        actionPlan = [
          {
            step: 'Analyze key findings and data',
            description: `Review the main conclusions and data points, especially those concerning: ${keyTerms.slice(0, 3).join(', ')}. Identify trends and patterns.`,
            priority: 'high'
          },
          {
            step: 'Share with relevant stakeholders',
            description: 'Distribute the report to team members and departments who need to be informed of these findings.',
            priority: 'medium'
          },
          {
            step: 'Develop action items from recommendations',
            description: 'Create specific tasks based on the report recommendations and assign responsibilities with deadlines.',
            priority: 'medium'
          }
        ];
        break;
        
      case 'proposal':
        actionPlan = [
          {
            step: 'Evaluate proposal feasibility',
            description: `Assess the viability and resource requirements of the proposed ideas, particularly regarding: ${keyTerms.slice(0, 3).join(', ')}.`,
            priority: 'high'
          },
          {
            step: 'Gather stakeholder feedback',
            description: 'Present the proposal to key decision-makers and collect their input, concerns, and suggestions.',
            priority: 'high'
          },
          {
            step: 'Create implementation roadmap',
            description: 'If approved, develop a detailed timeline and resource allocation plan for executing the proposal.',
            priority: 'medium'
          }
        ];
        break;
        
      case 'policy':
        actionPlan = [
          {
            step: 'Understand policy requirements',
            description: `Thoroughly review all policy guidelines and requirements, especially those related to: ${keyTerms.slice(0, 3).join(', ')}.`,
            priority: 'high'
          },
          {
            step: 'Communicate to affected parties',
            description: 'Inform all employees or individuals affected by this policy and provide necessary training or guidance.',
            priority: 'high'
          },
          {
            step: 'Implement compliance measures',
            description: 'Set up systems and processes to ensure ongoing compliance with the policy requirements.',
            priority: 'medium'
          }
        ];
        break;
        
      case 'meeting':
        actionPlan = [
          {
            step: 'Follow up on action items',
            description: `Review all assigned tasks from the meeting and send reminders to responsible parties. Priority topics include: ${keyTerms.slice(0, 3).join(', ')}.`,
            priority: 'high'
          },
          {
            step: 'Distribute meeting minutes',
            description: 'Share the meeting summary with all attendees and relevant stakeholders who were unable to attend.',
            priority: 'medium'
          },
          {
            step: 'Schedule follow-up meeting',
            description: 'If needed, schedule a follow-up session to track progress on decisions and action items.',
            priority: 'low'
          }
        ];
        break;
        
      case 'research':
        actionPlan = [
          {
            step: 'Validate research methodology',
            description: `Review the research approach and data collection methods. Consider implications for: ${keyTerms.slice(0, 3).join(', ')}.`,
            priority: 'high'
          },
          {
            step: 'Apply findings to current work',
            description: 'Identify how the research conclusions can be integrated into ongoing projects or inform future decisions.',
            priority: 'medium'
          },
          {
            step: 'Share insights with team',
            description: 'Present relevant findings to your team and discuss potential applications or further research needs.',
            priority: 'medium'
          }
        ];
        break;
        
      default:
        actionPlan = [
          {
            step: 'Review complete document thoroughly',
            description: `Read through the entire document carefully, paying attention to sections about: ${keyTerms.slice(0, 3).join(', ')}. Note any questions or unclear points.`,
            priority: 'high'
          },
          {
            step: 'Identify key stakeholders',
            description: 'Determine who needs to be informed or consulted about this document and reach out to them promptly.',
            priority: 'medium'
          },
          {
            step: 'Take required actions',
            description: 'Complete any tasks, decisions, or responses indicated in the document within specified timeframes.',
            priority: 'medium'
          }
        ];
    }
    
    if (targetLanguage !== 'en') {
      const langCode = SUPPORTED_LANGUAGES[targetLanguage];
      for (let action of actionPlan) {
        action.step = await translateText(action.step, langCode, 'en');
        action.description = await translateText(action.description, langCode, 'en');
      }
    }
    
    return actionPlan;
    
  } catch (error) {
    console.error('Action plan generation failed:', error);
    return [
      {
        step: 'Review the full document',
        description: 'Read through the complete document to understand all details and context.',
        priority: 'high'
      },
      {
        step: 'Identify key stakeholders',
        description: 'Determine who needs to be informed or involved based on the document content.',
        priority: 'medium'
      },
      {
        step: 'Create implementation timeline',
        description: 'Develop a timeline for any actions or decisions mentioned in the document.',
        priority: 'medium'
      }
    ];
  }
}

async function processPDFDocument(pdfPath, targetLanguage, options = {}) {
  const {
    summaryLength = 1000,
    sourceLanguage = 'en'
  } = options;

  try {
    const langCode = SUPPORTED_LANGUAGES[targetLanguage.toLowerCase()];
    if (!langCode) {
      throw new Error(
        `Unsupported language: ${targetLanguage}. Supported languages: spanish, french, mandarin`
      );
    }

    console.log('Step 1: Extracting text from PDF...');
    const fullText = await extractTextFromPDF(pdfPath);
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('No text could be extracted from the PDF');
    }

    console.log('Step 2: Creating summary...');
    const summary = summarizeText(fullText, summaryLength);

    console.log('Step 3: Translating summary...');
    const translatedSummary = await translateText(summary, langCode, sourceLanguage);
    
    console.log('Step 4: Generating action plan...');
    const actionPlan = await generateActionPlan(summary, targetLanguage, fullText);

    return {
      success: true,
      originalText: fullText,
      originalLength: fullText.length,
      summary: summary,
      summaryLength: summary.length,
      translatedSummary: translatedSummary,
      actionPlan: actionPlan,
      targetLanguage: targetLanguage,
      languageCode: langCode,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error processing document:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  processPDFDocument,
  extractTextFromPDF,
  translateText,
  summarizeText,
  generateActionPlan,
  SUPPORTED_LANGUAGES
};