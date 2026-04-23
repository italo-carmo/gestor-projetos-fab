export type ComplaintSummaryPrivacyFindingCategory =
  | "RANK_PLUS_NAME"
  | "POSSIBLE_PERSON_NAME";

export type ComplaintSummaryPrivacyFindingConfidence = "HIGH" | "MEDIUM";

export type ComplaintSummaryPrivacyFinding = {
  excerpt: string;
  start: number;
  end: number;
  category: ComplaintSummaryPrivacyFindingCategory;
  confidence: ComplaintSummaryPrivacyFindingConfidence;
  explanation: string;
  source: "heuristic" | "llm";
};

export type ComplaintSummaryPrivacyReview = {
  status: "clear" | "flagged";
  checkedText: string;
  findings: ComplaintSummaryPrivacyFinding[];
  engine: "heuristic" | "llm" | "hybrid";
  model: string | null;
  userMessage: string;
};

export type ComplaintSummaryHighlightSegment = {
  key: string;
  text: string;
  highlighted: boolean;
  findings: ComplaintSummaryPrivacyFinding[];
};

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeFinding(
  value: unknown,
): ComplaintSummaryPrivacyFinding | null {
  const record = toRecord(value);
  if (!record) return null;

  const excerpt = String(record.excerpt ?? "").trim();
  const start = Number(record.start);
  const end = Number(record.end);
  if (!excerpt || !Number.isInteger(start) || !Number.isInteger(end)) {
    return null;
  }

  return {
    excerpt,
    start,
    end,
    category:
      String(record.category ?? "")
        .trim()
        .toUpperCase() === "POSSIBLE_PERSON_NAME"
        ? "POSSIBLE_PERSON_NAME"
        : "RANK_PLUS_NAME",
    confidence:
      String(record.confidence ?? "")
        .trim()
        .toUpperCase() === "MEDIUM"
        ? "MEDIUM"
        : "HIGH",
    explanation: String(record.explanation ?? "").trim(),
    source:
      String(record.source ?? "")
        .trim()
        .toLowerCase() === "heuristic"
        ? "heuristic"
        : "llm",
  };
}

export function normalizeComplaintSummaryForComparison(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasComplaintSummaryChanged(
  currentValue: unknown,
  nextValue: unknown,
) {
  return (
    normalizeComplaintSummaryForComparison(currentValue) !==
    normalizeComplaintSummaryForComparison(nextValue)
  );
}

export function extractComplaintSummaryPrivacyReview(
  error: unknown,
): ComplaintSummaryPrivacyReview | null {
  const data = toRecord(
    (error as { response?: { data?: unknown } })?.response?.data,
  );
  const details = toRecord(data?.details);
  if (
    String(details?.reason ?? "").trim() !==
    "AI_POSSIBLE_MILITARY_NAMES_DETECTED"
  ) {
    return null;
  }

  const analysis = toRecord(details?.analysis);
  if (!analysis) return null;

  const findingsSource = Array.isArray(analysis.findings)
    ? analysis.findings
    : [];
  const findings = findingsSource
    .map((item) => normalizeFinding(item))
    .filter((item): item is ComplaintSummaryPrivacyFinding => Boolean(item))
    .sort((left, right) => {
      if (left.start !== right.start) return left.start - right.start;
      if (left.end !== right.end) return left.end - right.end;
      return left.excerpt.localeCompare(right.excerpt, "pt-BR");
    });

  return {
    status:
      String(analysis.status ?? "").trim() === "clear" ? "clear" : "flagged",
    checkedText: String(analysis.checkedText ?? ""),
    findings,
    engine:
      String(analysis.engine ?? "").trim() === "heuristic"
        ? "heuristic"
        : String(analysis.engine ?? "").trim() === "llm"
          ? "llm"
          : "hybrid",
    model: String(analysis.model ?? "").trim() || null,
    userMessage:
      String(analysis.userMessage ?? "").trim() ||
      "A Inteligência Artificial identificou a presença de possíveis nomes no texto.",
  };
}

export function buildComplaintSummaryHighlightSegments(
  text: string,
  findings: ComplaintSummaryPrivacyFinding[],
): ComplaintSummaryHighlightSegment[] {
  const checkedText = String(text ?? "");
  const safeFindings = [...(findings ?? [])]
    .filter(
      (finding) =>
        Number.isInteger(finding?.start) &&
        Number.isInteger(finding?.end) &&
        finding.start < finding.end,
    )
    .map((finding) => ({
      ...finding,
      start: Math.max(0, Math.min(checkedText.length, finding.start)),
      end: Math.max(0, Math.min(checkedText.length, finding.end)),
    }))
    .filter((finding) => finding.start < finding.end)
    .sort((left, right) => {
      if (left.start !== right.start) return left.start - right.start;
      return left.end - right.end;
    });

  if (!checkedText) return [];
  if (safeFindings.length === 0) {
    return [
      {
        key: "plain-0",
        text: checkedText,
        highlighted: false,
        findings: [],
      },
    ];
  }

  const ranges: Array<{
    start: number;
    end: number;
    findings: ComplaintSummaryPrivacyFinding[];
  }> = [];

  for (const finding of safeFindings) {
    const current = ranges[ranges.length - 1];
    if (!current || finding.start > current.end) {
      ranges.push({
        start: finding.start,
        end: finding.end,
        findings: [finding],
      });
      continue;
    }

    current.end = Math.max(current.end, finding.end);
    current.findings.push(finding);
  }

  const segments: ComplaintSummaryHighlightSegment[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      segments.push({
        key: `plain-${index}-${cursor}`,
        text: checkedText.slice(cursor, range.start),
        highlighted: false,
        findings: [],
      });
    }

    segments.push({
      key: `highlight-${index}-${range.start}-${range.end}`,
      text: checkedText.slice(range.start, range.end),
      highlighted: true,
      findings: range.findings,
    });
    cursor = range.end;
  });

  if (cursor < checkedText.length) {
    segments.push({
      key: `plain-tail-${cursor}`,
      text: checkedText.slice(cursor),
      highlighted: false,
      findings: [],
    });
  }

  return segments.filter((segment) => segment.text.length > 0);
}
