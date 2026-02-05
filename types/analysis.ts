// types/analysis.ts
// EV2 상세페이지 분석 타입 정의

export interface AnalysisStartResponse {
  success: boolean;
  analysisId: number;
  status: string;
  message: string;
  estimatedTime: number;
}

export interface AnalysisStatusResponse {
  success: boolean;
  analysisId: number;
  status: 'pending' | 'scraping' | 'downloading' | 'analyzing' | 'saving' | 'completed' | 'failed';
  progress: number;
  progressMessage: string;
  startedAt?: string;
  completedAt?: string;
  processingTime?: number;
  error?: string;
}

export interface KeyIngredient {
  name: string;
  concentration: string | null;
  benefits: string[];
}

export interface AnalysisData {
  productName: string;
  brand: string;
  category: string;
  subCategory?: string;
  targetSkin: string[];
  keyIngredients: KeyIngredient[];
  mainBenefits: string[];
  texture?: string;
  usage: string;
  capacity?: string;
  cautions: string[];
  priceRange: string;
  uniqueSellingPoints: string[];
  marketingKeywords: string[];
  competitiveAdvantage: string;
  suggestions: string[];
  summary: string;
}

export interface AnalysisResult {
  id: number;
  url: string;
  productName: string;
  brand: string;
  category: string;
  analyzedAt: string;
  processingTimeSeconds: number;
  status: string;
  summary: string;
  analysisData: AnalysisData;
  detailImages: string[];
}

export interface AnalysisDetailResponse {
  success: boolean;
  data: AnalysisResult;
}

export interface AnalysisListItem {
  id: number;
  url: string;
  productName: string;
  brand: string;
  category: string;
  status: string;
  summary: string;
  analyzedAt: string;
  processingTimeSeconds: number;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AnalysisListResponse {
  success: boolean;
  data: AnalysisListItem[];
  pagination: Pagination;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}
