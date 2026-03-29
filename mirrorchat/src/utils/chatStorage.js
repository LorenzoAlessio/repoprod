const STORAGE_KEY = 'mirrorchat_saved_reports';

/**
 * Saves a new chat analysis report into localStorage.
 * Keeps only the last 20 reports to avoid hitting storage quotas.
 */
export function saveChatReport(reportData) {
  try {
    const existing = getSavedReports();
    
    // Create a summarized version of the report to save space
    // Only keeping categories and severity to feed the Quiz AI later
    const summary = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      gravita_media: reportData.riepilogo?.gravita_media || 1,
      categorie_rilevate: reportData.riepilogo?.categorie_rilevate || [],
      // Keep up to 5 problematic messages as context (max 200 chars each)
      context_messages: (reportData.report || [])
        .filter(m => m.gravita > 2 && m.categoria !== 'nessuna')
        .slice(0, 5)
        .map(m => ({
          categoria: m.categoria,
          testo: m.messaggio.substring(0, 200)
        }))
    };

    existing.unshift(summary);
    // Keep max 20 latest reports
    if (existing.length > 20) {
      existing.pop();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save chat report:', err);
  }
}

/**
 * Retrieves all saved chat reports from localStorage.
 */
export function getSavedReports() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Aggregates all unique abusive categories detected in the user's history.
 * Returns an array of category strings.
 */
export function getSavedChatTags() {
  const reports = getSavedReports();
  const tagsSet = new Set();
  
  reports.forEach(r => {
    (r.categorie_rilevate || []).forEach(cat => {
      if (cat && cat.toLowerCase() !== 'nessuna') {
        tagsSet.add(cat.toLowerCase().trim());
      }
    });
  });
  
  return Array.from(tagsSet);
}

/**
 * Gets a small sample of the most problematic messages from history to use as AI context.
 */
export function getProblematicContext() {
  const reports = getSavedReports();
  let contextLines = [];
  
  for (const r of reports) {
    if (r.context_messages && r.context_messages.length > 0) {
      for (const msg of r.context_messages) {
        contextLines.push(`[Tema: ${msg.categoria}] " ${msg.testo} "`);
        if (contextLines.length >= 10) break;
      }
    }
    if (contextLines.length >= 10) break;
  }
  
  return contextLines;
}
