interface SourceBadgeProps {
  name: string;
  color: string;  // hex e.g. '#cc0000'
}

export default function SourceBadge({ name, color }: SourceBadgeProps) {
  return (
    <span
      className="source-badge"
      style={{ backgroundColor: color, color: '#fff' }}
    >
      {name}
    </span>
  );
}
