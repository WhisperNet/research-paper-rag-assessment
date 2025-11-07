import { getTopQuestions } from './analytics';
import { generateAnswer } from './ollamaClient';
import { retrieveFromQdrant, rerankBySectionWeight } from './retrieval';
import { buildContext } from './context';
import { logger } from '../config/logger';

/**
 * Summarize multiple questions into a single distinct topic using AI
 */
export async function summarizeQuestionsToTopic(
  questions: string[]
): Promise<string> {
  if (!questions.length) {
    throw new Error('No questions provided for summarization');
  }

  const prompt = [
    'You are analyzing research questions to identify common topics.',
    'Below are the top questions users have been asking:',
    '',
    ...questions.map((q, idx) => `${idx + 1}. ${q}`),
    '',
    'Analyze these questions and identify a single distinct topic or research area that best encompasses them.',
    'Respond with ONLY a concise topic phrase (2-8 words) that captures the main theme.',
    'Do not include explanations, just the topic phrase.',
    'Examples: "Machine Learning Model Performance", "Climate Change Effects", "Quantum Computing Applications"',
    '',
    'Topic:',
  ].join('\n');

  const topic = await generateAnswer(prompt);
  return topic.trim();
}

/**
 * Generate an informative response about a topic using retrieved context
 */
export async function generateTopicInsight(
  topic: string,
  topK = 5
): Promise<{
  topic: string;
  insight: string;
  citations: any[];
  sources_used: string[];
  confidence: number;
}> {
  // Retrieve relevant context for the topic
  const retrieved = await retrieveFromQdrant(topic, topK);
  const reranked = rerankBySectionWeight(retrieved, topK);

  // Build context from retrieved chunks
  const { contextItems, citations, sourcesUsed } = await buildContext(reranked);

  // If no context found, return uncertain response
  if (!contextItems.length) {
    return {
      topic,
      insight:
        'I am uncertain about this topic because no relevant context was found in the research papers.',
      citations: [],
      sources_used: [],
      confidence: 0.2,
    };
  }

  // Construct prompt for topic insight
  const contextStr = contextItems
    .map(
      (c, idx) =>
        `[Source ${idx + 1}: ${c.source.paper_title || 'Unknown'}, ${
          c.source.section || ''
        }, p.${c.source.page || 'N/A'}]\n${c.text}`
    )
    .join('\n\n');

  const prompt = [
    '<context>',
    contextStr,
    '</context>',
    '',
    'You are a research assistant named SageAI analyzing popular research topics.',
    `The topic "${topic}" has been identified as a common area of interest based on user questions.`,
    '',
    'Using ONLY the provided context from research papers:',
    '1. Provide a comprehensive overview of this topic',
    '2. Highlight key findings, methods, or insights from the research',
    '3. Explain why this topic is significant or what makes it interesting',
    '',
    'Use markdown formatting for readability.',
    'Cite sources explicitly in the form [paper_title, section, page].',
    'If the context does not adequately cover the topic, acknowledge the limitations.',
    '',
    `Write an insightful summary about: ${topic}`,
  ].join('\n');

  const insight = await generateAnswer(prompt);

  // Calculate confidence based on top retrieval score
  const confidence = Math.min(
    0.99,
    Math.max(0.2, reranked[0]?.score ? Number(reranked[0].score) : 0.5)
  );

  return {
    topic,
    insight,
    citations,
    sources_used: sourcesUsed,
    confidence,
  };
}

/**
 * Main function to get popular topic with AI-generated insights
 */
export async function getPopularTopicInsight(): Promise<{
  topic: string;
  insight: string;
  questions_analyzed: string[];
  citations: any[];
  sources_used: string[];
  confidence: number;
}> {
  try {
    // Get top 10 questions
    const topQuestions = await getTopQuestions(10);

    if (!topQuestions.length) {
      throw new Error('No questions found in database');
    }

    // Summarize questions into a single topic
    const topic = await summarizeQuestionsToTopic(topQuestions);

    logger.info(
      { topic, questionsCount: topQuestions.length },
      'Identified popular topic'
    );

    // Generate insight about the topic using context
    const result = await generateTopicInsight(topic, 7); // Use more chunks for comprehensive insight

    return {
      ...result,
      questions_analyzed: topQuestions,
    };
  } catch (err) {
    logger.error({ err }, 'Failed to generate popular topic insight');
    throw err;
  }
}
