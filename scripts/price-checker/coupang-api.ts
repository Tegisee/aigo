import { createHmac } from 'crypto';

const BASE_URL = 'https://api-gateway.coupang.com';
const SEARCH_PATH =
  '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || '';
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || '';

function generateAuthorization(
  method: string,
  path: string,
  query: string = '',
): string {
  const now = new Date();
  const datetime = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(2);

  const message = datetime + method + path + query;
  const signature = createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

export interface CoupangProduct {
  productId: number;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
}

export async function searchProducts(
  keyword: string,
  limit: number = 5,
): Promise<CoupangProduct[]> {
  if (!ACCESS_KEY || !SECRET_KEY) {
    console.error('[CoupangAPI] API 키 없음');
    return [];
  }

  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  const authorization = generateAuthorization('GET', SEARCH_PATH, query);

  const res = await fetch(`${BASE_URL}${SEARCH_PATH}?${query}`, {
    method: 'GET',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json;charset=UTF-8',
    },
  });

  const json = await res.json();
  if (json.rCode === '0' && json.data?.productData) {
    return json.data.productData.map((p: any) => ({
      productId: p.productId,
      productName: p.productName,
      productPrice: p.productPrice,
      productImage: p.productImage,
      productUrl: p.productUrl,
    }));
  }

  console.warn('[CoupangAPI] 검색 실패:', json.rCode, json.rMessage);
  return [];
}

export function extractProductId(url: string): string | null {
  const match = url.match(/\/products\/(\d+)/);
  return match ? match[1] : null;
}

export async function fetchCurrentPrice(
  productName: string,
  productId: string | null,
  currentPrice: number = 0,
): Promise<{ price: number; image: string; name: string } | null> {
  if (!productName || !productId) {
    console.log(`  [API] productId 없음 → 스킵`);
    return null;
  }

  const words = productName.split(/\s+/).map(w => w.replace(/[,()]/g, '')).filter(Boolean);
  const keywords = [
    words.slice(0, 4).join(' '),
    words.slice(0, 2).join(' '),
  ].filter((k) => k.length >= 2);

  for (const keyword of keywords) {
    console.log(`  [API] 검색: "${keyword}" (productId=${productId})`);
    const products = await searchProducts(keyword, 5);

    if (products.length === 0) continue;

    // 1순위: productId 정확 매칭
    const exactMatches = products.filter((p) => String(p.productId) === productId);
    if (exactMatches.length > 0) {
      let best = exactMatches[0];
      if (exactMatches.length > 1 && currentPrice > 0) {
        best = exactMatches.reduce((a, b) =>
          Math.abs(a.productPrice - currentPrice) <= Math.abs(b.productPrice - currentPrice) ? a : b
        );
      }

      if (currentPrice > 0) {
        const changeRate = Math.abs(best.productPrice - currentPrice) / currentPrice;
        if (changeRate > 0.3) {
          console.log(`  [API] 가격 변동 ${(changeRate * 100).toFixed(0)}% 초과 → 스킵`);
          return null;
        }
      }

      return { price: best.productPrice, image: best.productImage, name: best.productName };
    }

    console.log(`  [API] productId=${productId} 정확 매칭 실패 → 가격 근접 매칭 시도`);

    // 2순위: productId 매칭 실패 시 가격 근접 상품으로 fallback
    if (currentPrice > 0 && products.length > 0) {
      const closest = products.reduce((a, b) =>
        Math.abs(a.productPrice - currentPrice) <= Math.abs(b.productPrice - currentPrice) ? a : b
      );
      const changeRate = Math.abs(closest.productPrice - currentPrice) / currentPrice;
      // 10% 이내 가격 차이면 같은 상품으로 간주
      if (changeRate <= 0.1) {
        console.log(`  [API] 가격 근접 매칭: ${closest.productName.slice(0, 30)} (${closest.productPrice}원, 차이 ${(changeRate * 100).toFixed(1)}%)`);
        return { price: closest.productPrice, image: closest.productImage, name: closest.productName };
      }
      console.log(`  [API] 가격 근접 매칭도 실패 (최소 차이 ${(changeRate * 100).toFixed(1)}%)`);
    }
  }

  return null;
}
