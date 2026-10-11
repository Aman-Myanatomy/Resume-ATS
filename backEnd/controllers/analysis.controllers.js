import {
  processAndSaveAnalysis,
  getUserAnalyses,
  getAnalysisById as fetchAnalysisById
} from '../services/analysis.services.js';

/**
 * Analysis Controller Layer
 * Handles ATS analysis requests and history retrieval.
 */

export async function analyze(req, res, next) {
  try {
    const { text, jobDescription } = req.body || {};
    const file = req.file;
    const userId = req.auth.sub;

    const result = await processAndSaveAnalysis({
      userId,
      file,
      text,
      jobDescription
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAnalyses(req, res, next) {
  try {
    const userId = req.auth.sub;
    const analyses = await getUserAnalyses(userId);
    res.json({ analyses });
  } catch (error) {
    next(error);
  }
}

export async function getAnalysisById(req, res, next) {
  try {
    const userId = req.auth.sub;
    const { id } = req.params;
    
    const analysis = await fetchAnalysisById(id, userId);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    res.json({ analysis });
  } catch (error) {
    next(error);
  }
}

