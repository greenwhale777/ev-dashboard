/**
 * ============================================================
 * 올리브영 DB 관련 API 라우트
 * ============================================================
 * /api/oy/batch/*     - 배치 수집 관리
 * /api/oy/products/*  - 제품 조회/검색
 * /api/oy/ai-chat     - AI 채팅
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../services/database');
const {
  initBatchTables, ensureCategory, startBatchJob, runAnalysisOnly,
  getBatchStatus, getAllCategoryStatus, CATEGORY_DEFINITIONS
} = require('../services/batch-analyzer');

// DB 초기화
initBatchTables();

// ============================================================
// 카테고리 관리
// ============================================================

// GET /api/oy/categories - 카테고리 목록 + 수집 현황
router.get('/categories', async (req, res) => {
  try {
    const categories = await getAllCategoryStatus();
    
    // DB에 없는 카테고리 정의도 포함
    const allCategories = Object.entries(CATEGORY_DEFINITIONS).map(([key, def]) => {
      const dbCat = categories.find(c => c.category_key === key);
      return {
        categoryKey: key,
        bigCategory: def.bigCategory,
        midCategory: def.midCategory,
        smallCategory: def.smallCategory,
        productCount: dbCat ? parseInt(dbCat.product_count) : 0,
        analyzedCount: dbCat ? parseInt(dbCat.analyzed_count) : 0,
        lastAnalyzed: dbCat?.last_analyzed || null,
        latestBatchStatus: dbCat?.latest_batch_status || null,
        latestBatchId: dbCat?.latest_batch_id || null,
        isActive: dbCat?.is_active ?? true
      };
    });
    
    res.json({ success: true, data: allCategories });
  } catch (err) {
    console.error('Categories error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 배치 수집 관리
// ============================================================

// POST /api/oy/batch/start - 배치 수집 시작 (하이브리드: 로컬 에이전트 수집 대기)
router.post('/batch/start', async (req, res) => {
  try {
    const { categoryKey, maxProducts = 100 } = req.body;

    console.log(`📥 batch/start 요청: categoryKey=${categoryKey}, maxProducts=${maxProducts}, body=`, JSON.stringify(req.body));

    if (!categoryKey || !CATEGORY_DEFINITIONS[categoryKey]) {
      return res.status(400).json({
        success: false,
        error: `유효하지 않은 카테고리: ${categoryKey}`,
        availableCategories: Object.keys(CATEGORY_DEFINITIONS)
      });
    }

    // 이미 진행 중인 작업 확인
    const running = await pool.query(
      `SELECT id FROM oy_batch_jobs
       WHERE status IN ('pending_collection', 'collecting', 'analyzing')
       AND created_at > NOW() - INTERVAL '2 hours'`
    );

    if (running.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: '이미 진행 중인 배치 작업이 있습니다',
        runningJobId: running.rows[0].id
      });
    }

    // 카테고리 DB 등록
    const categoryId = await ensureCategory(categoryKey);

    // 작업 등록 (수집은 로컬 에이전트가 처리)
    const result = await pool.query(
      `INSERT INTO oy_batch_jobs (category_id, status, total_products, started_at)
       VALUES ($1, 'pending_collection', $2, NOW()) RETURNING id`,
      [categoryId, maxProducts]
    );
    const jobId = result.rows[0].id;

    console.log(`📋 배치 작업 등록: ${CATEGORY_DEFINITIONS[categoryKey].smallCategory} (Job #${jobId}, 로컬 수집 대기)`);

    res.json({
      success: true,
      data: { jobId, categoryKey, maxProducts, status: 'pending_collection' },
      message: `${CATEGORY_DEFINITIONS[categoryKey].smallCategory} 수집이 시작되었습니다`
    });
  } catch (err) {
    console.error('Batch start error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/oy/batch-analyze/:jobId - 수집 완료 후 분석 시작 (로컬 에이전트가 호출)
router.post('/batch-analyze/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);

    const job = await pool.query(
      'SELECT * FROM oy_batch_jobs WHERE id = $1', [jobId]
    );

    if (!job.rows[0]) {
      return res.status(404).json({ success: false, error: '작업을 찾을 수 없습니다' });
    }

    if (job.rows[0].status !== 'collected') {
      return res.status(400).json({
        success: false,
        error: `수집 완료 상태가 아닙니다 (현재: ${job.rows[0].status})`
      });
    }

    console.log(`🚀 분석 시작 요청: Job #${jobId} (로컬 에이전트 수집 완료)`);

    // 비동기로 분석 실행
    runAnalysisOnly(jobId, job.rows[0].category_id).catch(err => {
      console.error(`❌ 분석 실패 (Job #${jobId}):`, err.message);
    });

    res.json({
      success: true,
      data: { jobId, status: 'analyzing' },
      message: '분석이 시작되었습니다'
    });
  } catch (err) {
    console.error('Batch analyze error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/oy/batch/:id/stop - 배치 수집 중지
router.post('/batch/:id/stop', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const result = await pool.query(
      `UPDATE oy_batch_jobs SET status = 'stopped', completed_at = NOW()
       WHERE id = $1 AND status IN ('collecting', 'analyzing')
       RETURNING id`,
      [jobId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '진행 중인 배치를 찾을 수 없습니다' });
    }
    console.log(`⏹ 배치 작업 중지: Job #${jobId}`);
    res.json({ success: true, message: '배치 수집이 중지되었습니다' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/oy/batch/:id - 배치 작업 상태
router.get('/batch/:id', async (req, res) => {
  try {
    const status = await getBatchStatus(parseInt(req.params.id));
    if (!status) {
      return res.status(404).json({ success: false, error: '작업을 찾을 수 없습니다' });
    }
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/oy/batch - 최근 배치 작업 목록
router.get('/batch', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT j.*, c.category_key, c.small_category
      FROM oy_batch_jobs j
      JOIN oy_categories c ON j.category_id = c.id
      ORDER BY j.created_at DESC
      LIMIT 20
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 제품 조회 / 검색
// ============================================================

// GET /api/oy/products - 제품 목록 (카테고리 필터)
router.get('/products', async (req, res) => {
  try {
    const { category, brand, search, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT p.*, c.category_key, c.big_category, c.small_category,
             a.status as analysis_status,
             a.product_name_detected, a.brand_detected,
             a.total_blocks, a.image_count, a.processing_time,
             a.analyzed_at,
             a.manufacturer, a.full_ingredients
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;
    
    if (category) {
      query += ` AND c.category_key = $${paramIdx++}`;
      params.push(category);
    }
    if (brand) {
      query += ` AND LOWER(p.brand_name) LIKE LOWER($${paramIdx++})`;
      params.push(`%${brand}%`);
    }
    if (search) {
      query += ` AND (LOWER(p.product_name) LIKE LOWER($${paramIdx++}) OR LOWER(p.brand_name) LIKE LOWER($${paramIdx++}))`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY p.rank_in_category ASC NULLS LAST`;
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // 총 수
    let countQuery = `
      SELECT COUNT(*) FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id WHERE 1=1
    `;
    const countParams = [];
    let cIdx = 1;
    if (category) { countQuery += ` AND c.category_key = $${cIdx++}`; countParams.push(category); }
    if (brand) { countQuery += ` AND LOWER(p.brand_name) LIKE LOWER($${cIdx++})`; countParams.push(`%${brand}%`); }
    if (search) { countQuery += ` AND (LOWER(p.product_name) LIKE LOWER($${cIdx++}) OR LOWER(p.brand_name) LIKE LOWER($${cIdx++}))`; countParams.push(`%${search}%`, `%${search}%`); }
    
    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Products error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/oy/products/:id - 제품 상세 (분석 결과 포함)
router.get('/products/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.category_key, c.big_category, c.mid_category, c.small_category,
             a.id as analysis_id, a.status as analysis_status,
             a.product_name_detected, a.brand_detected, a.volume, a.product_type,
             a.full_ingredients, a.block_analysis, a.block_type_distribution,
             a.product_essentials, a.efficacy_points, a.key_ingredients,
             a.safety_tests, a.formula_info, a.how_to_use,
             a.summary, a.total_blocks, a.image_count, a.processing_time,
             a.analyzed_at, a.manufacturer
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE p.id = $1
    `, [parseInt(req.params.id)]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '제품을 찾을 수 없습니다' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// AI 채팅
// ============================================================

// 공통: DB row → 상세 텍스트 변환 헬퍼
function formatDetailedFields(r) {
  let text = '';

  if (r.efficacy_points) {
    const points = typeof r.efficacy_points === 'string' ? JSON.parse(r.efficacy_points) : r.efficacy_points;
    if (points.length > 0) {
      points.forEach((p, i) => {
        text += `  핵심포인트${i+1}: ${p.headline || ''}\n`;
        if (p.subCopy) text += `    설명: ${p.subCopy}\n`;
        if (p.details?.length) text += `    상세: ${p.details.join(' / ')}\n`;
        if (p.clinicalNote) text += `    임상근거: ${p.clinicalNote}\n`;
      });
    }
  }

  if (r.key_ingredients) {
    const ings = typeof r.key_ingredients === 'string' ? JSON.parse(r.key_ingredients) : r.key_ingredients;
    if (ings.length > 0) {
      ings.forEach(i => {
        text += `  성분: ${i.name}`;
        if (i.benefit) text += ` - ${i.benefit}`;
        if (i.concentration) text += ` (${i.concentration})`;
        text += `\n`;
      });
    }
  }

  if (r.safety_tests) {
    const tests = typeof r.safety_tests === 'string' ? JSON.parse(r.safety_tests) : r.safety_tests;
    if (tests.length > 0) {
      tests.forEach(t => {
        text += `  임상테스트: ${t.testName || ''}\n`;
        if (t.description) text += `    결과: ${t.description}\n`;
        if (t.institution) text += `    기관: ${t.institution}\n`;
        if (t.period) text += `    기간: ${t.period}\n`;
        if (t.subjects) text += `    대상: ${t.subjects}\n`;
      });
    }
  }

  if (r.formula_info) {
    const fi = typeof r.formula_info === 'string' ? JSON.parse(r.formula_info) : r.formula_info;
    if (fi.pH) text += `  pH: ${fi.pH}\n`;
    if (fi.texture) text += `  제형: ${fi.texture}\n`;
    if (fi.keyFeature) text += `  특징: ${fi.keyFeature}\n`;
  }

  if (r.how_to_use) {
    const h = typeof r.how_to_use === 'string' ? JSON.parse(r.how_to_use) : r.how_to_use;
    if (h && !h.steps) {
      ['salesRecord', 'rankings', 'certifications', 'formulaFeatures', 'targetAudience', 'others'].forEach(key => {
        if (h[key]?.length) text += `  ${key}: ${h[key].join(', ')}\n`;
      });
    }
  }

  if (r.summary) text += `  요약: ${r.summary}\n`;

  return text;
}

// AI 쿼리 함수 맵
const dataQueries = {
  // 카테고리별 제품 목록 (기본정보 + 모든 상세 필드)
  async category_products({ categoryKey, limit = 20 }) {
    const result = await pool.query(`
      SELECT p.rank_in_category as rank, p.brand_name as brand, p.product_name as name,
             p.product_url,
             a.efficacy_points, a.key_ingredients, a.formula_info, a.safety_tests,
             a.how_to_use, a.product_essentials, a.summary
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE c.category_key = $1
      ORDER BY p.rank_in_category ASC
      LIMIT $2
    `, [categoryKey, limit]);

    if (result.rows.length === 0) return `[${categoryKey}] 데이터 없음`;

    let text = `=== ${categoryKey} 카테고리 제품 목록 (${result.rows.length}개) ===\n`;
    result.rows.forEach(r => {
      text += `\n${r.rank}위: ${r.brand} - ${r.name}\n`;
      if (r.product_url) text += `URL: ${r.product_url}\n`;
      text += formatDetailedFields(r);
    });
    return text;
  },

  // 특정 제품 상세정보 (모든 분석 필드 포함)
  async product_detail({ productName, brand }) {
    let query = `
      SELECT p.rank_in_category, p.brand_name, p.product_name, p.product_url,
             c.small_category,
             a.product_essentials, a.full_ingredients, a.summary,
             a.efficacy_points, a.key_ingredients, a.safety_tests,
             a.formula_info, a.how_to_use, a.volume, a.product_type
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (productName) {
      query += ` AND LOWER(p.product_name) LIKE LOWER($${idx++})`;
      params.push(`%${productName}%`);
    }
    if (brand) {
      query += ` AND LOWER(p.brand_name) LIKE LOWER($${idx++})`;
      params.push(`%${brand}%`);
    }
    query += ' LIMIT 3';

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return `[${productName || brand}] 제품을 찾을 수 없음`;

    let text = '';
    result.rows.forEach(r => {
      text += `=== ${r.brand_name} - ${r.product_name} ===\n`;
      text += `카테고리: ${r.small_category} / 순위: ${r.rank_in_category}위\n`;
      if (r.volume) text += `용량: ${r.volume}\n`;
      if (r.product_type) text += `제품타입: ${r.product_type}\n`;
      text += `URL: ${r.product_url}\n`;
      text += formatDetailedFields(r);
      if (r.full_ingredients) {
        text += `전성분: ${r.full_ingredients}\n`;
      }
      text += '\n';
    });
    return text;
  },

  // 성분 검색 (상세 필드 포함)
  async search_ingredient({ ingredient }) {
    const result = await pool.query(`
      SELECT p.brand_name, p.product_name, p.rank_in_category, p.product_url,
             c.small_category,
             a.key_ingredients, a.formula_info, a.efficacy_points,
             a.safety_tests, a.how_to_use, a.summary
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE a.key_ingredients::text ILIKE $1
         OR a.full_ingredients ILIKE $1
      ORDER BY p.rank_in_category ASC
      LIMIT 20
    `, [`%${ingredient}%`]);

    if (result.rows.length === 0) return `[${ingredient}] 포함 제품 없음`;

    let text = `=== "${ingredient}" 포함 제품 (${result.rows.length}개) ===\n`;
    result.rows.forEach(r => {
      text += `\n${r.small_category} ${r.rank_in_category}위: ${r.brand_name} - ${r.product_name}\n`;
      if (r.product_url) text += `URL: ${r.product_url}\n`;
      text += formatDetailedFields(r);
    });
    return text;
  },

  // 브랜드별 제품 목록 (상세 필드 포함)
  async brand_products({ brand }) {
    const result = await pool.query(`
      SELECT p.brand_name, p.product_name, p.rank_in_category, p.product_url,
             c.small_category,
             a.efficacy_points, a.key_ingredients, a.formula_info,
             a.safety_tests, a.how_to_use, a.summary
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE LOWER(p.brand_name) LIKE LOWER($1)
      ORDER BY c.small_category, p.rank_in_category
      LIMIT 20
    `, [`%${brand}%`]);

    if (result.rows.length === 0) return `[${brand}] 브랜드 제품 없음`;

    let text = `=== "${brand}" 브랜드 제품 (${result.rows.length}개) ===\n`;
    result.rows.forEach(r => {
      text += `\n${r.small_category} ${r.rank_in_category}위: ${r.brand_name} - ${r.product_name}\n`;
      if (r.product_url) text += `URL: ${r.product_url}\n`;
      text += formatDetailedFields(r);
    });
    return text;
  },

  // 전체 DB 요약
  async db_summary() {
    const result = await pool.query(`
      SELECT c.small_category, c.category_key,
             COUNT(DISTINCT p.id) as product_count,
             COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as analyzed_count
      FROM oy_categories c
      LEFT JOIN oy_products p ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id
      GROUP BY c.id
      ORDER BY c.big_category, c.mid_category
    `);
    
    let text = '=== DB 현황 ===\n';
    let totalProducts = 0, totalAnalyzed = 0;
    result.rows.forEach(r => {
      text += `${r.small_category}: ${r.product_count}개 제품, ${r.analyzed_count}개 분석완료\n`;
      totalProducts += parseInt(r.product_count);
      totalAnalyzed += parseInt(r.analyzed_count);
    });
    text += `\n총: ${totalProducts}개 제품, ${totalAnalyzed}개 분석완료\n`;
    return text;
  },

  // 제품 비교 (모든 상세 필드 포함)
  async compare_products({ product1, product2 }) {
    const result = await pool.query(`
      SELECT p.brand_name, p.product_name, p.rank_in_category, p.product_url,
             c.small_category,
             a.product_essentials, a.key_ingredients, a.formula_info,
             a.efficacy_points, a.safety_tests, a.how_to_use,
             a.full_ingredients, a.volume, a.product_type, a.summary
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE LOWER(p.product_name) LIKE LOWER($1) OR LOWER(p.product_name) LIKE LOWER($2)
      LIMIT 2
    `, [`%${product1}%`, `%${product2}%`]);

    if (result.rows.length < 2) return `비교할 2개 제품을 찾을 수 없음 (${result.rows.length}개 매치)`;

    let text = '=== 제품 비교 ===\n';
    result.rows.forEach((r, i) => {
      text += `\n[제품 ${i+1}] ${r.brand_name} - ${r.product_name}\n`;
      text += `카테고리: ${r.small_category} / 순위: ${r.rank_in_category}위\n`;
      if (r.product_url) text += `URL: ${r.product_url}\n`;
      if (r.volume) text += `용량: ${r.volume}\n`;
      if (r.product_type) text += `제품타입: ${r.product_type}\n`;
      text += formatDetailedFields(r);
      if (r.full_ingredients) text += `전성분: ${r.full_ingredients}\n`;
    });
    return text;
  },

  // 카테고리 내 공통 성분 트렌드
  async category_ingredient_trend({ categoryKey }) {
    const result = await pool.query(`
      SELECT a.key_ingredients
      FROM oy_products p
      JOIN oy_categories c ON p.category_id = c.id
      JOIN oy_product_analyses a ON a.product_id = p.id AND a.status = 'completed'
      WHERE c.category_key = $1
    `, [categoryKey]);
    
    if (result.rows.length === 0) return `[${categoryKey}] 분석 데이터 없음`;
    
    // 성분 빈도 집계
    const ingredientCount = {};
    result.rows.forEach(r => {
      const ings = typeof r.key_ingredients === 'string' ? JSON.parse(r.key_ingredients) : (r.key_ingredients || []);
      ings.forEach(i => {
        const name = i.name;
        ingredientCount[name] = (ingredientCount[name] || 0) + 1;
      });
    });
    
    const sorted = Object.entries(ingredientCount).sort((a, b) => b[1] - a[1]);
    
    let text = `=== ${categoryKey} 카테고리 인기 성분 TOP 20 ===\n`;
    text += `(${result.rows.length}개 제품 분석 기준)\n\n`;
    sorted.slice(0, 20).forEach(([name, count], i) => {
      const pct = (count / result.rows.length * 100).toFixed(0);
      text += `${i+1}. ${name}: ${count}개 제품 (${pct}%)\n`;
    });
    return text;
  },

  // 사용 가능한 카테고리 목록
  async available_categories() {
    const result = await pool.query(`
      SELECT c.category_key, c.big_category, c.small_category,
             COUNT(DISTINCT p.id) as product_count,
             COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as analyzed_count
      FROM oy_categories c
      LEFT JOIN oy_products p ON p.category_id = c.id
      LEFT JOIN oy_product_analyses a ON a.product_id = p.id
      GROUP BY c.id ORDER BY c.big_category
    `);
    let text = '=== 사용 가능한 카테고리 ===\n';
    result.rows.forEach(r => {
      text += `${r.category_key} (${r.big_category} > ${r.small_category}): ${r.analyzed_count}/${r.product_count}개 분석\n`;
    });
    return text;
  }
};

// POST /api/oy/ai-chat - AI 채팅
router.post('/ai-chat', async (req, res) => {
  try {
    const { question, chatId } = req.body;
    
    if (!question) {
      return res.status(400).json({ success: false, error: '질문을 입력해주세요' });
    }
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다' });
    }
    
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    
    // 카테고리 목록 가져오기
    const catResult = await pool.query(
      `SELECT category_key, small_category FROM oy_categories ORDER BY big_category`
    );
    const categoryList = catResult.rows.map(r => `${r.category_key} (${r.small_category})`).join(', ');
    
    // 1단계: 질문 분석 → 쿼리 결정
    const step1Prompt = `당신은 올리브영 화장품 데이터 분석 시스템의 쿼리 플래너입니다.
사용자의 질문을 분석하고, 답변에 필요한 데이터 쿼리를 결정해주세요.

## 사용 가능한 카테고리
${categoryList || '아직 등록된 카테고리 없음'}

## 사용 가능한 쿼리 함수
1. category_products(categoryKey, limit) - 카테고리별 제품 목록 (순위, 브랜드, 성분, 효능)
2. product_detail(productName, brand) - 특정 제품 상세정보 (전성분, 핵심정보 전체)
3. search_ingredient(ingredient) - 특정 성분 포함 제품 검색
4. brand_products(brand) - 브랜드별 제품 목록
5. db_summary() - 전체 DB 현황 요약
6. compare_products(product1, product2) - 2개 제품 비교
7. category_ingredient_trend(categoryKey) - 카테고리 내 인기 성분 트렌드
8. available_categories() - 사용 가능한 카테고리 목록

## 규칙
- 최대 3개 쿼리까지 선택
- 질문에 가장 적합한 쿼리를 선택
- "비교" → compare_products
- "성분", "포함" → search_ingredient
- "트렌드", "인기", "공통" → category_ingredient_trend
- "브랜드" → brand_products
- 특정 제품 → product_detail
- "임상", "테스트", "안전성", "검증" → category_products (safety_tests 데이터 포함)
- "모든 제품", "전체", "전부" → limit을 최대값(100)으로 설정
- 사용자가 상세한 답변을 원하면 limit을 높게 설정 (50~100)

사용자 질문: ${question}

다음 JSON 형식으로만 응답하세요:
{
  "queries": [
    {"function": "함수명", "params": {"키": "값"}}
  ],
  "reasoning": "이 쿼리를 선택한 이유 (한 줄)"
}`;

    console.log('🤖 [OY AI Chat 1단계] 쿼리 플래닝...');
    const step1Result = await model.generateContent(step1Prompt);
    const step1Text = step1Result.response.text();
    
    let queryPlan;
    try {
      const jsonMatch = step1Text.match(/```json\n?([\s\S]*?)\n?```/) || step1Text.match(/\{[\s\S]*\}/);
      queryPlan = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) {
      console.error('쿼리 플랜 파싱 실패:', step1Text);
      queryPlan = { queries: [{ function: 'db_summary', params: {} }] };
    }
    
    console.log('📋 쿼리 플랜:', JSON.stringify(queryPlan.queries));
    
    // 2단계: 데이터 조회
    let contextData = '';
    for (const q of (queryPlan.queries || []).slice(0, 3)) {
      const fn = dataQueries[q.function];
      if (fn) {
        try {
          const data = await fn(q.params || {});
          contextData += data + '\n\n';
        } catch (e) {
          console.error(`쿼리 실행 실패 (${q.function}):`, e.message);
          contextData += `[${q.function} 실행 실패: ${e.message}]\n\n`;
        }
      }
    }
    
    if (!contextData.trim()) {
      contextData = '데이터를 조회할 수 없습니다.';
    }
    
    // 3단계: 답변 생성
    console.log('🤖 [OY AI Chat 2단계] 답변 생성...');
    const step2Prompt = `당신은 올리브영 화장품 시장 분석 전문가입니다.
아래는 데이터베이스에서 조회한 실제 올리브영 제품 분석 데이터입니다.

${contextData}

사용자 질문: ${question}

## 답변 규칙
1. 데이터에 있는 정보를 최대한 상세하게 활용하세요. 요약하지 말고 모든 관련 데이터를 포함하세요.
2. 보고서 형태로 체계적으로 정리하세요: 제목, 소제목, 표, 구분선 등을 활용하세요.
3. 성분, 효능, pH, 임상테스트 수치를 인용할 때는 정확하게 기재하세요.
4. 제품을 언급할 때 "브랜드 - 상품명" 형식으로 기재하세요.
5. 데이터가 부족하면 솔직하게 "해당 데이터가 아직 수집되지 않았습니다"라고 답변하세요.
6. 인사이트나 추측은 최소화하고, DB에 저장된 팩트 중심으로 답변하세요.
7. 임상테스트 정보가 있으면 시험기관, 기간, 대상인원, 결과를 모두 포함하세요.
8. 각 제품별로 빠짐없이 정리하세요. 일부만 언급하지 말고 데이터가 있는 모든 제품을 포함하세요.
9. 답변은 충분히 길어도 됩니다. 정보의 완전성이 간결성보다 중요합니다.
10. 제품을 언급할 때 올리브영 URL이 데이터에 포함되어 있으면 마크다운 링크 형식으로 표시하세요. 형식: "브랜드 - 제품명 [올리브영 →](URL)"
11. 표(테이블) 형식으로 답변할 때는 마크다운 테이블 문법(| ... | ... |)을 사용하세요. 표 안에서 제품명 열에 [제품명](URL) 형식으로 링크를 걸어주세요.`;

    const step2Result = await model.generateContent(step2Prompt);
    const answer = step2Result.response.text();
    
    // DB에 대화 저장
    let activeChatId = chatId;
    try {
      if (!activeChatId) {
        const newChat = await pool.query(
          `INSERT INTO oy_ai_chats (title) VALUES ($1) RETURNING id`,
          [question.substring(0, 60)]
        );
        activeChatId = newChat.rows[0].id;
      } else {
        await pool.query(`UPDATE oy_ai_chats SET updated_at = NOW() WHERE id = $1`, [activeChatId]);
      }
      await pool.query(
        `INSERT INTO oy_ai_messages (chat_id, role, content) VALUES ($1, 'user', $2)`,
        [activeChatId, question]
      );
      await pool.query(
        `INSERT INTO oy_ai_messages (chat_id, role, content, queries_used) VALUES ($1, 'assistant', $2, $3)`,
        [activeChatId, answer, JSON.stringify(queryPlan.queries?.map(q => q.function) || [])]
      );
    } catch (saveErr) {
      console.error('채팅 저장 실패:', saveErr.message);
    }
    
    console.log('✅ OY AI Chat 완료');
    res.json({
      success: true,
      data: { answer, chatId: activeChatId, queriesUsed: queryPlan.queries?.map(q => q.function) }
    });
  } catch (err) {
    console.error('AI Chat error:', err.message);
    res.status(500).json({ success: false, error: 'AI 분석 실패: ' + err.message });
  }
});

// GET /api/oy/ai-chats - 채팅 이력
router.get('/ai-chats', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, created_at, updated_at FROM oy_ai_chats ORDER BY updated_at DESC LIMIT 30`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/oy/ai-chats/:id - 특정 채팅 메시지
router.get('/ai-chats/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM oy_ai_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [parseInt(req.params.id)]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/oy/ai-chats/:id
router.delete('/ai-chats/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM oy_ai_chats WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
