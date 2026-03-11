function deepStripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => deepStripUndefined(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === undefined) continue;
      out[key] = deepStripUndefined(val);
    }

    return out as T;
  }

  return value;
}

function normalizeAbtRecord(record: any) {
  return {
    ...record,
    diagnostics: {
      ...record.diagnostics,
      isDeviceAssociated:
        typeof record?.diagnostics?.isDeviceAssociated === 'boolean'
          ? record.diagnostics.isDeviceAssociated
          : false,
    },
  };
}

function normalizeVaxEvent(record: any) {
  return {
    ...record,
    dueDate: record?.dueDate ?? null,
  };
}

function normalizeInfection(record: any) {
  return {
    ...record,
    sourceOfInfection: record?.sourceOfInfection ?? '',
  };
}

function normalizeLineListEvent(record: any) {
  return {
    ...record,
    fever: record?.fever ?? false,
  };
}

function normalizeSliceRecord(sliceName: string, record: any) {
  switch (sliceName) {
    case 'abts':
      return normalizeAbtRecord(record);
    case 'vaxEvents':
      return normalizeVaxEvent(record);
    case 'infections':
      return normalizeInfection(record);
    case 'lineListEvents':
      return normalizeLineListEvent(record);
    default:
      return record;
  }
}

function findUndefinedPaths(value: any, prefix = ''): string[] {
  if (value === undefined) return [prefix || '(root)'];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findUndefinedPaths(item, `${prefix}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      findUndefinedPaths(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [];
}

function requirePathPart(name: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[FirestorePath] Invalid path segment: ${name}=${String(value)}`);
  }
  return value;
}

export { deepStripUndefined, normalizeSliceRecord, findUndefinedPaths, requirePathPart };