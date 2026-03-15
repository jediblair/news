import SourceForm from '../SourceForm';

export default function NewSourcePage() {
  return (
    <div className="space-y-6">
      <h1 className="headline text-3xl font-bold">Add Source</h1>
      <p className="text-gray-600 text-sm">
        Enter the domain and click <strong>Auto-detect</strong> to discover RSS feeds and content selectors automatically.
      </p>
      <SourceForm mode="create" />
    </div>
  );
}
