interface MastheadProps {
  date: Date;
  editionLabel?: string;
}

export default function Masthead({ date, editionLabel }: MastheadProps) {
  const formatted = date.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <header className="masthead">
      <p className="masthead-edition">{formatted}{editionLabel ? ` — ${editionLabel}` : ''}</p>
      <h1 className="masthead-title">The Daily Digest</h1>
      <p className="masthead-tagline">All the news that&rsquo;s fit to aggregate</p>
    </header>
  );
}
