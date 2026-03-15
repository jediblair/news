export const dynamic = 'force-dynamic';
import { db }             from '@/lib/db';
import TagManagerClient   from './TagManagerClient';

const DEFAULT_TAGS = [
  'politics','world','nz','au','us','uk','tech','business','science',
  'health','sport','climate','crime','entertainment','opinion','finance','economy',
  'iran','war','middle-east','russia','ukraine','china','military','energy','elections','conflict',
];

async function loadTags(): Promise<string[]> {
  try {
    const { rows } = await db.query<{ value: string[] }>(
      `SELECT value FROM app_settings WHERE key = 'classifier_tags'`,
    );
    if (rows.length > 0 && Array.isArray(rows[0].value) && rows[0].value.length > 0) {
      return rows[0].value as string[];
    }
  } catch { /* fall back */ }
  return DEFAULT_TAGS;
}

export default async function ClassifierPage() {
  const tags = await loadTags();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="headline text-3xl font-bold mb-1">Classifier Tags</h1>
        <p className="text-gray-500 text-sm">
          Manage the topic tags the AI classifier can assign to each article.
        </p>
      </div>
      <TagManagerClient initialTags={tags} />
    </div>
  );
}
