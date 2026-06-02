/** 从年级数组 ["G5","G8","G12"] 中取最大数值 */
export function maxGradeNum(grades: string[] | null | undefined): number | null {
  if (!grades?.length) return null;
  return grades.reduce((max, g) => Math.max(max, parseInt(g.replace('G', '')) || 0), 0);
}

/** 从年级数组中取最大值的原始字符串（用于表单回填） */
export function maxGradeCode(grades: string[] | null | undefined): string | undefined {
  if (!grades?.length) return undefined;
  let best = grades[0];
  let bestNum = parseInt(best.replace('G', '')) || 0;
  for (const g of grades) {
    const n = parseInt(g.replace('G', '')) || 0;
    if (n > bestNum) { best = g; bestNum = n; }
  }
  return best;
}

/** 将单个年级上限展开为从最小到最大的完整范围（用于存储前转换） */
export function expandGradeRange(
  maxCode: string | undefined,
  allCodes: string[]
): string[] {
  if (!maxCode) return [];
  const idx = allCodes.indexOf(maxCode);
  if (idx === -1) return [maxCode];
  return allCodes.slice(0, idx + 1);
}
