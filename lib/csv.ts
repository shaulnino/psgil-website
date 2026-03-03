export async function fetchCsv(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function splitCsvRows(csv: string): string[] {
  const rows: string[] = [];
  const source = csv.replace(/^\uFEFF/, "");
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"\"";
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === "\n" && !inQuotes) {
      rows.push(current.replace(/\r$/, ""));
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) rows.push(current.replace(/\r$/, ""));
  return rows;
}

export function parseCsv<T extends Record<string, string>>(csv: string): T[] {
  const lines = splitCsvRows(csv).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);

    
    const obj = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index]?.trim() ?? "";
      return acc;
    }, {});
    
    return obj as unknown as T;    
  });
}
