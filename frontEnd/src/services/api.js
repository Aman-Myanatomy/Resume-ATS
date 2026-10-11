import {
  authenticateApi,
  analyzeResumeApi,
  getAnalysesHistoryApi,
  getAnalysisByIdApi
} from './api.services.js';

export const authenticate = authenticateApi;
export const analyzeResume = analyzeResumeApi;
export const getAnalysesHistory = getAnalysesHistoryApi;
export const getAnalysisById = getAnalysisByIdApi;

export * from './api.services.js';
